/**
 * Refresh Token Management
 *
 * Implements secure refresh token rotation with family-based invalidation.
 *
 * Security design:
 *  - Tokens are 32 bytes of cryptographic randomness (256 bits of entropy).
 *  - Stored as SHA-256 hashes (not bcrypt — high-entropy tokens don't need
 *    slow hashing, and SHA-256 allows O(1) lookups).
 *  - Every refresh rotates the token: old is revoked, new is issued.
 *  - Reuse of a revoked token invalidates the ENTIRE family (compromise signal).
 *  - Tokens are bound to a session for device tracking.
 */

import crypto from 'crypto';
import { authPrisma } from '@/lib/auth/db';
import { logWarn, logInfo } from '@/lib/logger';
import { logSecurityEvent } from '@/lib/security/audit';

const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10);

// ---------------------------------------------------------------------------
// Token hashing (deterministic — allows DB lookups)
// ---------------------------------------------------------------------------

export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateTokenPair(): { plaintext: string; hash: string } {
    const plaintext = crypto.randomBytes(32).toString('base64url');
    return { plaintext, hash: hashToken(plaintext) };
}

// ---------------------------------------------------------------------------
// Create a new refresh token + session
// ---------------------------------------------------------------------------

export interface CreateRefreshTokenInput {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
    /** Reuse an existing family (rotation) or omit to start a new family. */
    family?: string;
    /** Link to an existing AuthSession. Omit to create a new one. */
    sessionId?: string;
}

export interface RefreshTokenResult {
    plaintext: string;
    tokenId: string;
    sessionId: string;
    family: string;
    expiresAt: Date;
}

export async function createRefreshToken(
    input: CreateRefreshTokenInput
): Promise<RefreshTokenResult> {
    const { plaintext, hash } = generateTokenPair();
    const family = input.family || crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Create or reuse session
    let sessionId = input.sessionId;
    if (!sessionId) {
        const session = await authPrisma.authSession.create({
            data: {
                userId: input.userId,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
                deviceName: input.deviceName || deriveDeviceName(input.userAgent),
                expiresAt,
            },
        });
        sessionId = session.id;
    } else {
        // Update session activity
        await authPrisma.authSession.update({
            where: { id: sessionId },
            data: { lastActiveAt: new Date(), expiresAt },
        });
    }

    const token = await authPrisma.refreshToken.create({
        data: {
            tokenHash: hash,
            family,
            userId: input.userId,
            sessionId: sessionId ?? null,
            expiresAt,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        },
    });

    return {
        plaintext,
        tokenId: token.id,
        sessionId: sessionId!,
        family,
        expiresAt,
    };
}

// ---------------------------------------------------------------------------
// Rotate refresh token (validate old → revoke old → issue new)
// ---------------------------------------------------------------------------

export interface RotateResult {
    plaintext: string;
    tokenId: string;
    sessionId: string;
    family: string;
    expiresAt: Date;
    userId: string;
    user: { id: string; email: string; name: string | null; role: string; isStaff: boolean };
}

export async function rotateRefreshToken(
    plaintextToken: string,
    ipAddress?: string,
    userAgent?: string
): Promise<RotateResult> {
    const tokenHash = hashToken(plaintextToken);

    const existing = await authPrisma.refreshToken.findUnique({
        where: { tokenHash },
        include: {
            user: {
                select: { id: true, email: true, name: true, role: true, isStaff: true },
            },
        },
    });

    // Case 1: Token not found at all → invalid
    if (!existing) {
        throw new TokenError('INVALID', 'Refresh token not found');
    }

    // Case 2: Token was already revoked → REPLAY ATTACK
    // Invalidate the entire family as a precaution.
    if (existing.revokedAt) {
        logWarn(`[AUTH] Refresh token replay detected for user ${existing.userId}, family ${existing.family}`);
        await logSecurityEvent({
            action: 'TOKEN_REPLAY_DETECTED',
            resourceType: 'RefreshToken',
            resourceId: existing.id,
            userId: existing.userId,
            ipAddress,
            success: false,
            riskLevel: 'CRITICAL',
            metadata: { family: existing.family },
        });
        await invalidateFamily(existing.family);
        throw new TokenError('REPLAY', 'Refresh token has been revoked — all sessions in this family have been invalidated');
    }

    // Case 3: Token expired
    if (existing.expiresAt < new Date()) {
        await authPrisma.refreshToken.update({
            where: { id: existing.id },
            data: { revokedAt: new Date() },
        });
        throw new TokenError('EXPIRED', 'Refresh token expired');
    }

    // Rotate: revoke old, issue new in same family
    await authPrisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
    });

    const newToken = await createRefreshToken({
        userId: existing.userId,
        ipAddress,
        userAgent,
        family: existing.family,
        sessionId: existing.sessionId || undefined,
    });

    return {
        ...newToken,
        userId: existing.userId,
        user: existing.user,
    };
}

// ---------------------------------------------------------------------------
// Revocation helpers
// ---------------------------------------------------------------------------

/** Revoke all tokens in a family (used on replay detection or explicit logout). */
export async function invalidateFamily(family: string): Promise<void> {
    const now = new Date();
    await authPrisma.refreshToken.updateMany({
        where: { family, revokedAt: null },
        data: { revokedAt: now },
    });
    // Also revoke associated sessions
    const tokens = await authPrisma.refreshToken.findMany({
        where: { family },
        select: { sessionId: true },
        distinct: ['sessionId'],
    });
    const sessionIds = tokens.map((t: { sessionId: string | null }) => t.sessionId).filter(Boolean) as string[];
    if (sessionIds.length > 0) {
        await authPrisma.authSession.updateMany({
            where: { id: { in: sessionIds }, revokedAt: null },
            data: { revokedAt: now },
        });
    }
}

/** Revoke all tokens & sessions for a user (password change, account compromise). */
export async function invalidateAllUserTokens(userId: string): Promise<void> {
    const now = new Date();
    await authPrisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
    });
    await authPrisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
    });
    logInfo(`[AUTH] All tokens invalidated for user ${userId}`);
}

/** Revoke a single session and its tokens. */
export async function revokeSession(sessionId: string, userId: string): Promise<void> {
    const now = new Date();
    const session = await authPrisma.authSession.findUnique({
        where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
        throw new TokenError('INVALID', 'Session not found');
    }
    await authPrisma.authSession.update({
        where: { id: sessionId },
        data: { revokedAt: now },
    });
    await authPrisma.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: now },
    });
}

// ---------------------------------------------------------------------------
// Session listing (for "manage devices" UI)
// ---------------------------------------------------------------------------

export async function listActiveSessions(userId: string) {
    return authPrisma.authSession.findMany({
        where: {
            userId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
        orderBy: { lastActiveAt: 'desc' },
        select: {
            id: true,
            ipAddress: true,
            deviceName: true,
            country: true,
            lastActiveAt: true,
            createdAt: true,
        },
    });
}

// ---------------------------------------------------------------------------
// Cleanup (call from cron)
// ---------------------------------------------------------------------------

/** Delete expired/revoked tokens older than 30 days (GDPR / storage hygiene). */
export async function cleanupExpiredTokens(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await authPrisma.refreshToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: cutoff } },
                { revokedAt: { lt: cutoff } },
            ],
        },
    });
    const sessionResult = await authPrisma.authSession.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: cutoff } },
                { revokedAt: { lt: cutoff } },
            ],
        },
    });
    return result.count + sessionResult.count;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveDeviceName(userAgent?: string): string {
    if (!userAgent) return 'Unknown device';
    const ua = userAgent.toLowerCase();

    let browser = 'Unknown browser';
    if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('edg/')) browser = 'Edge';
    else if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('safari')) browser = 'Safari';

    let os = 'Unknown OS';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac os') || ua.includes('macos')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    return `${browser} on ${os}`;
}

// ---------------------------------------------------------------------------
// Custom error type
// ---------------------------------------------------------------------------

export class TokenError extends Error {
    constructor(
        public code: 'INVALID' | 'EXPIRED' | 'REPLAY',
        message: string
    ) {
        super(message);
        this.name = 'TokenError';
    }
}
