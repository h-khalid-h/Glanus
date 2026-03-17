import { ApiError } from '@/lib/errors';
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
 *   - Forgot password (non-enumerating email dispatch)
 *   - Profile retrieval with workspace memberships
 *   - Profile updates (name, email with uniqueness enforcement)
 *   - Password change (verify current, prevent reuse, bcrypt hash)
 *   - Onboarding completion
 *
 * Extracted to sibling services:
 *   - InvitationService → verifyInvitation / acceptInvitation
 *   - AssetActionService → getExecution
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
        if (existing) throw new ApiError(409, 'An account with this email already exists');

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
        if (!result) throw new ApiError(400, 'Invalid or tampered reset link. Please request a new one.');
        if (result.expired) throw new ApiError(400, 'This reset link has expired. Please request a new one.');

        const user = await prisma.user.findUnique({ where: { id: result.userId } });
        if (!user) throw new ApiError(400, 'Invalid reset link.');

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
        if (!profile) throw new ApiError(404, 'User not found.');
        return profile;
    }

    static async updateProfile(userId: string, data: { name?: string; email?: string }) {
        if (data.email) {
            const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
            if (data.email !== currentUser?.email) {
                const existing = await prisma.user.findUnique({ where: { email: data.email } });
                if (existing) throw new ApiError(409, 'An account with this email already exists.');
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
        if (!userRecord) throw new ApiError(404, 'User not found.');

        const isValid = await bcrypt.compare(currentPassword, userRecord.password);
        if (!isValid) throw new ApiError(401, 'Current password is incorrect.');

        const isSame = await bcrypt.compare(newPassword, userRecord.password);
        if (isSame) throw new ApiError(400, 'New password must be different from the current password.');

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
}

