import { ApiError } from '@/lib/errors';
/**
 * InvitationService — Workspace member invitation lifecycle management.
 *
 * Responsibilities:
 *  - sendInvitation: create a signed invitation token and dispatch the email
 *  - verifyInvitation: validate a token and return invitation metadata (pre-join)
 *  - acceptInvitation: consume the token and add the user as a workspace member
 *  - revokeInvitation: cancel a pending invitation before it is accepted
 *  - listInvitations: list all pending invitations for a workspace
 */
import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email/sendgrid';
import { getInvitationEmailTemplate } from '@/lib/email/templates';
import { randomBytes } from 'crypto';

export interface InviteInput {
    email: string;
    role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

/**
 * InvitationService — Full workspace invitation lifecycle.
 *
 * Responsibilities (admin side):
 *  - listInvitations: fetch all PENDING invitations for a workspace
 *  - createInvitation: validate, create, and send email invite
 *  - revokeInvitation: mark invitation as REVOKED
 *
 * Responsibilities (public/token side):
 *  - verifyInvitation: validate token, check expiry, return invitation details
 *  - acceptInvitation: validate token + email match, create membership in transaction,
 *    mark invitation ACCEPTED, write audit log
 */
export class InvitationService {
    static async listInvitations(workspaceId: string) {
        return prisma.workspaceInvitation.findMany({
            where: { workspaceId, status: 'PENDING' },
            include: { inviter: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    static async createInvitation(
        workspaceId: string,
        userId: string,
        workspaceName: string,
        data: InviteInput,
    ) {
        const { role } = data;
        const email = data.email.toLowerCase().trim();

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            const existingMembership = await prisma.workspaceMember.findUnique({
                where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
            });
            if (existingMembership) {
                throw new ApiError(409, 'User is already a member of this workspace');
            }
        }

        const existingInvitation = await prisma.workspaceInvitation.findFirst({
            where: { workspaceId, email, status: 'PENDING' },
        });
        if (existingInvitation) {
            throw new ApiError(409, 'Invitation already sent to this email');
        }

        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const invitation = await prisma.workspaceInvitation.create({
            data: { workspaceId, email, role, token, invitedBy: userId, expiresAt },
            include: {
                workspace: { select: { name: true } },
                inviter: { select: { name: true, email: true } },
            },
        });

        const inviterName = invitation.inviter?.name || invitation.inviter?.email || 'Someone';
        const inviteUrl = `${process.env.NEXTAUTH_URL}/invitations/${token}`;
        sendEmail({
            to: email,
            subject: `You've been invited to join ${workspaceName} on Glanus`,
            html: getInvitationEmailTemplate(inviterName, workspaceName, inviteUrl),
        }).catch((err: unknown) => logError('Failed to send invitation email', err));

        return { invitation, start_url: inviteUrl };
    }

    static async revokeInvitation(workspaceId: string, invitationId: string) {
        const invitation = await prisma.workspaceInvitation.findFirst({
            where: { id: invitationId, workspaceId },
        });
        if (!invitation) {
            throw new ApiError(404, 'Invitation not found');
        }
        await prisma.workspaceInvitation.update({
            where: { id: invitationId },
            data: { status: 'REVOKED' },
        });
        return { revoked: true };
    }

    /**
     * Validate a token-based invitation for public display (pre-accept).
     * Marks the invitation EXPIRED if the expiry date has passed.
     */
    static async verifyInvitation(token: string) {
        const invitation = await prisma.workspaceInvitation.findUnique({
            where: { token },
            include: {
                workspace: { select: { id: true, name: true } },
                inviter: { select: { id: true, name: true, email: true } },
            },
        });

        if (!invitation) throw new ApiError(404, 'Invitation not found or has expired');

        if (invitation.status !== 'PENDING') {
            throw new ApiError(400, `Invitation has already been ${invitation.status.toLowerCase()}`);
        }

        if (new Date() > invitation.expiresAt) {
            await prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
            throw new ApiError(400, 'This invitation has expired');
        }

        return {
            email: invitation.email, role: invitation.role,
            workspace: invitation.workspace, inviter: invitation.inviter,
            expiresAt: invitation.expiresAt,
        };
    }

    /**
     * Accept a token-based invitation: validate token + email match, create membership
     * in a transaction, mark invitation ACCEPTED, write audit log.
     */
    static async acceptInvitation(token: string, userEmail: string) {
        const invitation = await prisma.workspaceInvitation.findUnique({
            where: { token },
            include: { workspace: true },
        });

        if (!invitation) throw new ApiError(404, 'Invitation not found');

        if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
            throw new ApiError(403, 'This invitation was sent to a different email address');
        }

        const user = await prisma.user.findUnique({ where: { email: invitation.email } });
        if (!user) throw new ApiError(404, 'Account not found. Please sign up first.');

        // Use a transaction with re-read to prevent TOCTOU race conditions
        const result = await prisma.$transaction(async (tx) => {
            const current = await tx.workspaceInvitation.findUnique({ where: { id: invitation.id } });
            if (!current || current.status !== 'PENDING') {
                throw new ApiError(400, 'Invitation already used or revoked');
            }
            if (new Date() > current.expiresAt) {
                await tx.workspaceInvitation.update({ where: { id: current.id }, data: { status: 'EXPIRED' } });
                throw new ApiError(400, 'Invitation expired');
            }

            const existingMembership = await tx.workspaceMember.findUnique({
                where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
            });
            if (existingMembership) throw new ApiError(409, 'Already a member of this workspace');

            const membership = await tx.workspaceMember.create({
                data: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role },
            });
            await tx.workspaceInvitation.update({
                where: { id: invitation.id },
                data: { status: 'ACCEPTED', acceptedAt: new Date() },
            });
            return membership;
        });

        await prisma.auditLog.create({
            data: {
                workspaceId: invitation.workspaceId, userId: user.id,
                action: 'member.invited', resourceType: 'WorkspaceMember', resourceId: result.id,
                details: { role: invitation.role, invitedBy: invitation.invitedBy, acceptedVia: 'invitation_link' },
            },
        });

        return { success: true, workspace: invitation.workspace, membership: result, message: `You've joined ${invitation.workspace.name}!` };
    }
}
