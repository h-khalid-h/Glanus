import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { verifyResetToken, generateResetToken } from '@/lib/auth/password-reset';
import { logInfo } from '@/lib/logger';
import { sendEmail } from '@/lib/email/sendgrid';
import { getPasswordResetEmailTemplate } from '@/lib/email/templates';

/**
 * AccountService — Domain layer for user account self-management.
 *
 * Encapsulates:
 *   - User registration (email uniqueness, bcrypt hash, audit log)
 *   - Password reset (token verification, bcrypt hash)
 *   - Profile retrieval with workspace memberships
 *   - Profile updates (name, email with uniqueness enforcement)
 *   - Password change (verify current, prevent reuse, bcrypt hash)
 *   - Onboarding completion
 *   - Invitation verification and acceptance
 *   - Execution status polling
 */
export class AccountService {

    // ========================================
    // REGISTRATION & AUTH
    // ========================================

    /**
     * Register a new user. Throws 409 if the email already exists.
     * Returns a safe user object (no password hash).
     */
    static async register(name: string, email: string, password: string) {
        const existing = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });
        if (existing) throw Object.assign(new Error('An account with this email already exists'), { statusCode: 409 });

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: { name, email, password: hashedPassword, role: 'USER' },
            select: { id: true, name: true, email: true, role: true },
        });

        await prisma.auditLog.create({
            data: {
                action: 'USER_SIGNUP',
                resourceType: 'User',
                resourceId: user.id,
                userId: user.id,
                metadata: { signupTime: new Date().toISOString() },
            },
        });

        logInfo('New user registered', { userId: user.id, email });
        return user;
    }

    /**
     * Reset a user's password using a signed reset token.
     * Verifies the token, finds the user, and updates the password hash.
     */
    static async resetPassword(token: string, newPassword: string) {
        const result = verifyResetToken(token);
        if (!result) throw Object.assign(new Error('Invalid or tampered reset link. Please request a new one.'), { statusCode: 400 });
        if (result.expired) throw Object.assign(new Error('This reset link has expired. Please request a new one.'), { statusCode: 400 });

        const user = await prisma.user.findUnique({ where: { id: result.userId } });
        if (!user) throw Object.assign(new Error('Invalid reset link.'), { statusCode: 400 });

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: result.userId },
            data: { password: hashedPassword },
        });

        logInfo(`[AUTH] Password reset completed for user ${user.email}`);
        return { reset: true };
    }

    /**
     * Send a password reset email.
     * Always resolves (anti-enumeration: never reveals whether email exists).
     */
    static async forgotPassword(email: string): Promise<void> {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
            const token = generateResetToken(user.id);
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
            const resetUrl = `${baseUrl}/reset-password?token=${token}`;
            await sendEmail({
                to: email,
                subject: 'Reset your Glanus password',
                html: getPasswordResetEmailTemplate(resetUrl),
            });
        }
        // Always resolve — never reveal whether the email exists
    }

    // ========================================
    // PROFILE
    // ========================================

    static async getProfile(userId: string) {
        const profile = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, email: true, name: true, role: true,
                createdAt: true, updatedAt: true, onboardingCompleted: true,
                workspaceMemberships: {
                    select: {
                        id: true, role: true, joinedAt: true,
                        workspace: { select: { id: true, name: true } },
                    },
                    orderBy: { joinedAt: 'desc' },
                },
            },
        });
        if (!profile) throw Object.assign(new Error('User not found.'), { statusCode: 404 });
        return profile;
    }

    static async updateProfile(userId: string, data: { name?: string; email?: string }) {
        if (data.email) {
            const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
            if (data.email !== currentUser?.email) {
                const existing = await prisma.user.findUnique({ where: { email: data.email } });
                if (existing) throw Object.assign(new Error('An account with this email already exists.'), { statusCode: 409 });
            }
        }

        return prisma.user.update({
            where: { id: userId },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.email !== undefined && { email: data.email }),
            },
            select: { id: true, email: true, name: true, role: true, updatedAt: true },
        });
    }

    static async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
        if (!userRecord) throw Object.assign(new Error('User not found.'), { statusCode: 404 });

        const isValid = await bcrypt.compare(currentPassword, userRecord.password);
        if (!isValid) throw Object.assign(new Error('Current password is incorrect.'), { statusCode: 401 });

        const isSame = await bcrypt.compare(newPassword, userRecord.password);
        if (isSame) throw Object.assign(new Error('New password must be different from the current password.'), { statusCode: 400 });

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

        return { changed: true };
    }

    // ========================================
    // ONBOARDING
    // ========================================

    static async completeOnboarding(userId: string) {
        await prisma.user.update({ where: { id: userId }, data: { onboardingCompleted: true } });
        return { success: true };
    }

    // ========================================
    // INVITATIONS
    // ========================================

    static async verifyInvitation(token: string) {
        const invitation = await prisma.workspaceInvitation.findUnique({
            where: { token },
            include: {
                workspace: { select: { id: true, name: true } },
                inviter: { select: { id: true, name: true, email: true } },
            },
        });

        if (!invitation) throw Object.assign(new Error('Invitation not found or has expired'), { statusCode: 404 });

        if (invitation.status !== 'PENDING') {
            throw Object.assign(
                new Error(`Invitation has already been ${invitation.status.toLowerCase()}`),
                { statusCode: 400 },
            );
        }

        if (new Date() > invitation.expiresAt) {
            await prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
            throw Object.assign(new Error('This invitation has expired'), { statusCode: 400 });
        }

        return {
            email: invitation.email, role: invitation.role,
            workspace: invitation.workspace, inviter: invitation.inviter,
            expiresAt: invitation.expiresAt,
        };
    }

    static async acceptInvitation(token: string, userEmail: string) {
        const invitation = await prisma.workspaceInvitation.findUnique({
            where: { token },
            include: { workspace: true },
        });

        if (!invitation) throw Object.assign(new Error('Invitation not found'), { statusCode: 404 });

        if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
            throw Object.assign(new Error('This invitation was sent to a different email address'), { statusCode: 403 });
        }

        if (invitation.status !== 'PENDING') {
            throw Object.assign(new Error('Invitation already used or revoked'), { statusCode: 400 });
        }

        if (new Date() > invitation.expiresAt) {
            await prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
            throw Object.assign(new Error('Invitation expired'), { statusCode: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email: invitation.email } });
        if (!user) throw Object.assign(new Error('Account not found. Please sign up first.'), { statusCode: 404 });

        const existingMembership = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
        });
        if (existingMembership) throw Object.assign(new Error('Already a member of this workspace'), { statusCode: 409 });

        const result = await prisma.$transaction(async (tx) => {
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

    // ========================================
    // EXECUTION STATUS (action execution polling)
    // ========================================

    static async getExecution(executionId: string) {
        const execution = await prisma.assetActionExecution.findUnique({
            where: { id: executionId },
            include: {
                asset: { select: { id: true, name: true } },
                actionDefinition: { select: { name: true, label: true, actionType: true } },
            },
        });
        if (!execution) throw Object.assign(new Error('Execution not found'), { statusCode: 404 });
        return execution;
    }
}
