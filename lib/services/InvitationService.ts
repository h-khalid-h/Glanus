import { ApiError } from '@/lib/errors';
/**
 * InvitationService — Workspace member invitation lifecycle management.
 *
 * Security model:
 *  - The raw 32-byte hex token is sent ONLY in the invitation URL (email link).
 *  - The DB stores SHA-256(rawToken) in the `tokenHash` field — never the raw value.
 *  - Lookup by token: compute sha256(urlToken) → query `tokenHash`.
 *  - Legacy invitations with no tokenHash fall back to the plaintext `token` column
 *    so existing pending links continue to work during the migration window.
 *
 * Responsibilities:
 *  - listInvitations     — admin: list PENDING invitations for a workspace
 *  - createInvitation    — admin: validate, create, send email, write audit log
 *  - revokeInvitation    — admin: mark REVOKED, write audit log
 *  - resendInvitation    — admin: expire old token, issue new token, resend email
 *  - verifyInvitation    — public: validate token for display pre-accept
 *  - acceptInvitation    — public: consume token, create membership (or user), audit log
 */
import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email/sendgrid';
import { getInvitationEmailTemplate } from '@/lib/email/templates';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { invalidatePermissionCache } from '@/lib/rbac/permissionCache';
import { auditLog } from '@/lib/workspace/auditLog';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compute SHA-256 hex digest of a raw token string. */
function hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
}

/** Generate a cryptographically random 32-byte hex token. */
function generateRawToken(): string {
    return randomBytes(32).toString('hex');
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InviteInput {
    email: string;
    role: 'ADMIN' | 'STAFF' | 'MEMBER' | 'VIEWER';
}

export interface RequestContext {
    ipAddress?: string;
    userAgent?: string;
}

// ── Includes ──────────────────────────────────────────────────────────────────

/** Reusable Prisma include for invitation lookups — typed as const for proper inference. */
const INVITATION_INCLUDE = {
    workspace: { select: { id: true, name: true } },
    inviter: { select: { id: true, name: true, email: true } },
} as const;

// ── Service ───────────────────────────────────────────────────────────────────

export class InvitationService {

    // ── Admin: list ───────────────────────────────────────────────────────────

    static async listInvitations(workspaceId: string) {
        return prisma.workspaceInvitation.findMany({
            where: { workspaceId, status: 'PENDING' },
            include: { inviter: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ── Admin: create ─────────────────────────────────────────────────────────

    static async createInvitation(
        workspaceId: string,
        userId: string,
        workspaceName: string,
        data: InviteInput,
        ctx: RequestContext = {},
    ) {
        const { role } = data;
        const email = data.email.toLowerCase().trim();

        const invitation = await prisma.$transaction(async (tx) => {
            // Block if user is already a member
            const existingUser = await tx.user.findUnique({ where: { email } });
            if (existingUser) {
                const existingMembership = await tx.workspaceMember.findUnique({
                    where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
                });
                if (existingMembership) {
                    throw new ApiError(409, 'User is already a member of this workspace');
                }
            }

            // Block duplicate pending invitation
            const existingInvitation = await tx.workspaceInvitation.findFirst({
                where: { workspaceId, email, status: 'PENDING' },
            });
            if (existingInvitation) {
                throw new ApiError(409, 'Invitation already sent to this email');
            }

            const rawToken = generateRawToken();
            const tokenHash = hashToken(rawToken);
            const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

            // Store hash in DB; raw token goes into the URL only
            const created = await tx.workspaceInvitation.create({
                data: {
                    workspaceId,
                    email,
                    role,
                    token: rawToken,      // legacy field — kept for backward compat
                    tokenHash,            // secure lookup field
                    invitedBy: userId,
                    expiresAt,
                },
                include: {
                    workspace: { select: { name: true } },
                    inviter: { select: { name: true, email: true } },
                },
            });

            return { invitation: created, rawToken };
        });

        const inviterName =
            invitation.invitation.inviter?.name ||
            invitation.invitation.inviter?.email ||
            'Someone';
        const inviteUrl = `${process.env.NEXTAUTH_URL}/invitations/${invitation.rawToken}`;

        sendEmail({
            to: email,
            subject: `You've been invited to join ${workspaceName} on Glanus`,
            html: getInvitationEmailTemplate(inviterName, workspaceName, inviteUrl),
        }).catch((err: unknown) => logError('Failed to send invitation email', err));

        // Audit: invitation.sent
        auditLog({
            workspaceId,
            userId,
            action: 'invitation.sent',
            resourceType: 'WorkspaceInvitation',
            resourceId: invitation.invitation.id,
            details: { email, role },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        }).catch(() => {}); // non-blocking

        return { invitation: invitation.invitation, start_url: inviteUrl };
    }

    // ── Admin: revoke ─────────────────────────────────────────────────────────

    static async revokeInvitation(
        workspaceId: string,
        invitationId: string,
        revokingUserId: string,
        ctx: RequestContext = {},
    ) {
        const invitation = await prisma.workspaceInvitation.findFirst({
            where: { id: invitationId, workspaceId },
        });
        if (!invitation) throw new ApiError(404, 'Invitation not found');
        if (invitation.status !== 'PENDING') {
            throw new ApiError(400, `Invitation is already ${invitation.status.toLowerCase()}`);
        }

        await prisma.workspaceInvitation.update({
            where: { id: invitationId },
            data: { status: 'REVOKED' },
        });

        // Audit: invitation.cancelled
        auditLog({
            workspaceId,
            userId: revokingUserId,
            action: 'invitation.cancelled',
            resourceType: 'WorkspaceInvitation',
            resourceId: invitationId,
            details: { email: invitation.email, role: invitation.role },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        }).catch(() => {}); // non-blocking

        return { revoked: true };
    }

    // ── Admin: resend ─────────────────────────────────────────────────────────

    /**
     * Resend an invitation: expire the old one and issue a fresh 48-hour token.
     * This is safer than reusing the old token (limits replay window).
     */
    static async resendInvitation(
        workspaceId: string,
        invitationId: string,
        resendingUserId: string,
        workspaceName: string,
        ctx: RequestContext = {},
    ) {
        const existing = await prisma.workspaceInvitation.findFirst({
            where: { id: invitationId, workspaceId },
            include: { inviter: { select: { name: true, email: true } } },
        });
        if (!existing) throw new ApiError(404, 'Invitation not found');
        if (existing.status !== 'PENDING' && existing.status !== 'EXPIRED') {
            throw new ApiError(400, `Cannot resend an invitation with status: ${existing.status.toLowerCase()}`);
        }

        const rawToken = generateRawToken();
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

        await prisma.workspaceInvitation.update({
            where: { id: invitationId },
            data: {
                token: rawToken,
                tokenHash,
                status: 'PENDING',
                expiresAt,
                acceptedAt: null,
            },
        });

        const inviterName =
            existing.inviter?.name || existing.inviter?.email || 'Someone';
        const inviteUrl = `${process.env.NEXTAUTH_URL}/invitations/${rawToken}`;

        sendEmail({
            to: existing.email,
            subject: `Reminder: You've been invited to join ${workspaceName} on Glanus`,
            html: getInvitationEmailTemplate(inviterName, workspaceName, inviteUrl),
        }).catch((err: unknown) => logError('Failed to resend invitation email', err));

        // Audit: invitation.resent
        auditLog({
            workspaceId,
            userId: resendingUserId,
            action: 'invitation.resent',
            resourceType: 'WorkspaceInvitation',
            resourceId: invitationId,
            details: { email: existing.email, role: existing.role },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        }).catch(() => {}); // non-blocking

        return { resent: true };
    }

    // ── Public: verify token (pre-accept display) ─────────────────────────────

    /**
     * Validate a token from the URL and return invitation metadata for display.
     * Supports both new-style (hashed tokenHash) and legacy (plaintext token) lookup.
     * Marks expired invitations automatically.
     */
    static async verifyInvitation(rawToken: string) {
        const invitation = await InvitationService._findByToken(rawToken);

        if (!invitation) throw new ApiError(404, 'Invitation not found or has expired');

        if (invitation.status !== 'PENDING') {
            throw new ApiError(400, `Invitation has already been ${invitation.status.toLowerCase()}`);
        }

        if (new Date() > invitation.expiresAt) {
            await prisma.workspaceInvitation.update({
                where: { id: invitation.id },
                data: { status: 'EXPIRED' },
            });
            throw new ApiError(400, 'This invitation has expired');
        }

        return {
            email: invitation.email,
            role: invitation.role,
            workspace: invitation.workspace,
            inviter: invitation.inviter,
            expiresAt: invitation.expiresAt,
        };
    }

    // ── Public: accept (existing user) ───────────────────────────────────────

    /**
     * Accept an invitation for an already-authenticated user.
     * Validates token + email match, creates membership in a transaction.
     */
    static async acceptInvitation(
        rawToken: string,
        userEmail: string,
        ctx: RequestContext = {},
    ) {
        const invitation = await InvitationService._findByToken(rawToken);
        if (!invitation) throw new ApiError(404, 'Invitation not found');

        if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
            throw new ApiError(403, 'This invitation was sent to a different email address');
        }

        const user = await prisma.user.findUnique({ where: { email: invitation.email } });
        if (!user) throw new ApiError(404, 'Account not found. Please use the registration form to create your account.');

        const membership = await InvitationService._consumeInvitation(invitation, user.id);

        auditLog({
            workspaceId: invitation.workspaceId,
            userId: user.id,
            action: 'invitation.accepted',
            resourceType: 'WorkspaceMember',
            resourceId: membership.id,
            details: {
                role: invitation.role,
                invitedBy: invitation.invitedBy,
                acceptedVia: 'invitation_link',
            },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        }).catch(() => {}); // non-blocking

        // Legacy audit entry for backward compatibility with existing audit log queries
        auditLog({
            workspaceId: invitation.workspaceId,
            userId: user.id,
            action: 'member.added',
            resourceType: 'WorkspaceMember',
            resourceId: membership.id,
            details: { role: invitation.role, invitedBy: invitation.invitedBy },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        }).catch(() => {}); // non-blocking

        // Invalidate RBAC permission cache so the next /me call reflects the new workspace.
        invalidatePermissionCache(user.id).catch(() => {});

        return {
            success: true,
            workspace: invitation.workspace,
            membership,
            message: `You've joined ${invitation.workspace.name}!`,
        };
    }

    // ── Public: accept + register (new user) ─────────────────────────────────

    /**
     * Accept an invitation as a brand-new user (no existing account).
     * Creates the user account atomically within the same transaction as the membership.
     */
    static async acceptInvitationNewUser(
        rawToken: string,
        name: string,
        password: string,
        ctx: RequestContext = {},
    ) {
        const invitation = await InvitationService._findByToken(rawToken);
        if (!invitation) throw new ApiError(404, 'Invitation not found');

        // Ensure no existing account for this email
        const existingUser = await prisma.user.findUnique({
            where: { email: invitation.email },
        });
        if (existingUser) {
            throw new ApiError(409, 'An account already exists for this email. Please sign in to accept the invitation.');
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const { user, membership } = await prisma.$transaction(async (tx) => {
            // Re-validate invitation inside transaction to prevent TOCTOU
            const current = await tx.workspaceInvitation.findUnique({ where: { id: invitation.id } });
            if (!current || current.status !== 'PENDING') {
                throw new ApiError(400, 'Invitation already used or revoked');
            }
            if (new Date() > current.expiresAt) {
                await tx.workspaceInvitation.update({ where: { id: current.id }, data: { status: 'EXPIRED' } });
                throw new ApiError(400, 'Invitation has expired');
            }

            const newUser = await tx.user.create({
                data: {
                    name: name.trim(),
                    email: invitation.email,
                    password: hashedPassword,
                    role: 'USER',
                    emailVerified: true,        // trusted — invite email is pre-verified
                    emailVerifiedAt: new Date(),
                },
            });

            const newMembership = await tx.workspaceMember.create({
                data: {
                    workspaceId: invitation.workspaceId,
                    userId: newUser.id,
                    role: invitation.role,
                },
            });

            await tx.workspaceInvitation.update({
                where: { id: invitation.id },
                data: { status: 'ACCEPTED', acceptedAt: new Date() },
            });

            return { user: newUser, membership: newMembership };
        });

        // Audit: user.created
        auditLog({
            workspaceId: invitation.workspaceId,
            userId: user.id,
            action: 'user.created',
            resourceType: 'User',
            resourceId: user.id,
            details: { email: user.email, createdVia: 'invitation_signup' },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        }).catch(() => {});

        // Audit: invitation.accepted
        auditLog({
            workspaceId: invitation.workspaceId,
            userId: user.id,
            action: 'invitation.accepted',
            resourceType: 'WorkspaceMember',
            resourceId: membership.id,
            details: {
                role: invitation.role,
                invitedBy: invitation.invitedBy,
                acceptedVia: 'new_user_registration',
            },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        }).catch(() => {});

        // Invalidate RBAC permission cache for the newly-created user.
        invalidatePermissionCache(user.id).catch(() => {});

        return {
            success: true,
            workspace: invitation.workspace,
            membership,
            user: { id: user.id, name: user.name, email: user.email },
            message: `Account created and you've joined ${invitation.workspace.name}!`,
        };
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Look up an invitation by raw URL token.
     * Tries hashed lookup first (new invitations), then falls back to plaintext
     * token (legacy invitations created before this migration).
     */
    private static async _findByToken(rawToken: string) {
        const digest = hashToken(rawToken);

        // Primary: secure hashed lookup
        let invitation = await prisma.workspaceInvitation.findUnique({
            where: { tokenHash: digest },
            include: INVITATION_INCLUDE,
        });

        // Fallback: legacy plaintext lookup for invitations created before migration
        if (!invitation) {
            invitation = await prisma.workspaceInvitation.findUnique({
                where: { token: rawToken },
                include: INVITATION_INCLUDE,
            });
        }

        return invitation;
    }

    /**
     * Consume a validated invitation within a transaction: create membership, mark ACCEPTED.
     */
    private static async _consumeInvitation(
        invitation: { id: string; workspaceId: string; role: 'ADMIN' | 'STAFF' | 'MEMBER' | 'VIEWER' | 'OWNER'; expiresAt: Date },
        userId: string,
    ) {
        return prisma.$transaction(async (tx) => {
            // Re-read inside transaction to prevent TOCTOU races
            const current = await tx.workspaceInvitation.findUnique({ where: { id: invitation.id } });
            if (!current || current.status !== 'PENDING') {
                throw new ApiError(400, 'Invitation already used or revoked');
            }
            if (new Date() > current.expiresAt) {
                await tx.workspaceInvitation.update({ where: { id: current.id }, data: { status: 'EXPIRED' } });
                throw new ApiError(400, 'Invitation has expired');
            }

            const existingMembership = await tx.workspaceMember.findUnique({
                where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
            });
            if (existingMembership) throw new ApiError(409, 'Already a member of this workspace');

            const membership = await tx.workspaceMember.create({
                data: { workspaceId: invitation.workspaceId, userId, role: invitation.role },
            });

            await tx.workspaceInvitation.update({
                where: { id: invitation.id },
                data: { status: 'ACCEPTED', acceptedAt: new Date() },
            });

            return membership;
        });
    }
}
