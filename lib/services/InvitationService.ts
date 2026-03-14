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
 * InvitationService — Manages workspace invitation lifecycle.
 *
 * Responsibilities:
 *  - listInvitations: fetch all PENDING invitations for a workspace
 *  - createInvitation: validate, create, and send email invite
 *  - revokeInvitation: mark invitation as REVOKED
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
        const { email, role } = data;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            const existingMembership = await prisma.workspaceMember.findUnique({
                where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
            });
            if (existingMembership) {
                throw Object.assign(new Error('User is already a member of this workspace'), { statusCode: 409 });
            }
        }

        const existingInvitation = await prisma.workspaceInvitation.findFirst({
            where: { workspaceId, email, status: 'PENDING' },
        });
        if (existingInvitation) {
            throw Object.assign(new Error('Invitation already sent to this email'), { statusCode: 409 });
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
            throw Object.assign(new Error('Invitation not found'), { statusCode: 404 });
        }
        await prisma.workspaceInvitation.update({
            where: { id: invitationId },
            data: { status: 'REVOKED' },
        });
        return { revoked: true };
    }
}
