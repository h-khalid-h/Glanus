/**
 * Password Reset Token Utilities
 * 
 * Uses HMAC-signed tokens (no database model needed).
 * Token format: base64url(userId:expiry).hmacSignature
 * Valid for 1 hour.
 */
import crypto from 'crypto';

export function generateResetToken(userId: string): string {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error('NEXTAUTH_SECRET is required');

    const expiry = Date.now() + 3600000; // 1 hour
    const payload = Buffer.from(`${userId}:${expiry}`).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
}

export function verifyResetToken(token: string): { userId: string; expired: boolean } | null {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;

    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

    // Timing-safe comparison — lengths must match
    if (signature.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return null;
    }

    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const [userId, expiryStr] = decoded.split(':');
    if (!userId || !expiryStr) return null;
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry)) return null;

    return { userId, expired: Date.now() > expiry };
}
