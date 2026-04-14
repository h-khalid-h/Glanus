/**
 * Email Verification
 *
 * Generates a short-lived token, stores its SHA-256 hash in the DB,
 * and emails the plaintext link to the user. On verification the hash
 * is matched, the user's emailVerified flag is set, and the token is
 * consumed (single-use).
 */

import crypto from 'crypto';
import { authPrisma } from '@/lib/auth/db';
import { hashToken } from '@/lib/auth/tokens';
import { logInfo, logWarn } from '@/lib/logger';
import { sendEmail } from '@/lib/email/sendgrid';

const VERIFICATION_EXPIRY_HOURS = 24;

/**
 * Create a verification token and send the verification email.
 * Invalidates any previous unused tokens for the same user.
 */
export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
    // Invalidate previous tokens
    await authPrisma.emailVerification.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() }, // mark as consumed so they can't be reused
    });

    const plaintext = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(plaintext);
    const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

    await authPrisma.emailVerification.create({
        data: {
            userId,
            tokenHash,
            expiresAt,
        },
    });

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(plaintext)}`;

    await sendEmail({
        to: email,
        subject: 'Verify your email — Glanus',
        html: getVerificationEmailTemplate(verifyUrl),
    });

    logInfo(`[AUTH] Verification email sent to ${email}`);
}

/**
 * Verify an email token. Returns the userId on success.
 */
export async function verifyEmailToken(plaintextToken: string): Promise<{ userId: string }> {
    const tokenHash = hashToken(plaintextToken);

    const record = await authPrisma.emailVerification.findUnique({
        where: { tokenHash },
    });

    if (!record) {
        throw new Error('Invalid verification link.');
    }
    if (record.usedAt) {
        throw new Error('This verification link has already been used.');
    }
    if (record.expiresAt < new Date()) {
        throw new Error('This verification link has expired. Please request a new one.');
    }

    // Mark token as used + update user in a transaction
    await authPrisma.$transaction([
        authPrisma.emailVerification.update({
            where: { id: record.id },
            data: { usedAt: new Date() },
        }),
        authPrisma.user.update({
            where: { id: record.userId },
            data: { emailVerified: true, emailVerifiedAt: new Date() },
        }),
    ]);

    logInfo(`[AUTH] Email verified for user ${record.userId}`);
    return { userId: record.userId };
}

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeHrefUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) {
        return escapeHtml(url);
    }
    return '#';
}

function getVerificationEmailTemplate(verifyUrl: string): string {
    const eVerifyUrl = sanitizeHrefUrl(verifyUrl);
    const eBaseUrl = sanitizeHrefUrl(process.env.NEXTAUTH_URL || 'https://glanus.com');
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #2563eb; text-decoration: none; }
    .content { background: #f9fafb; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="${eBaseUrl}" class="logo">Glanus</a>
    </div>
    <div class="content">
      <h2>Verify your email address</h2>
      <p>Click the button below to verify your email and activate your account.</p>
      <a href="${eVerifyUrl}" class="button">Verify Email</a>
      <p style="margin-top: 20px; font-size: 13px; color: #6b7280;">
        This link expires in ${VERIFICATION_EXPIRY_HOURS} hours. If you didn't create a Glanus account, you can safely ignore this email.
      </p>
    </div>
    <div class="footer">
      <p>&copy; Glanus. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}
