/**
 * Workspace Claim Revocation
 *
 * JWT workspace claims (wid / wRole) have a 15-minute lifetime.  When a
 * membership is changed or removed we must ensure the stale claim cannot be
 * used for the rest of its natural lifetime.
 *
 * Pattern:
 *   - On membership change/removal, write a short-lived Redis key.
 *   - requireWorkspaceAccess() checks the key before trusting a JWT claim.
 *   - If the key exists  → the claim is revoked → fall back to DB verification.
 *   - If Redis is unavailable → conservative default: treat claim as revoked
 *     → fall back to DB (safe, never elevates privilege).
 *   - After 15 min the key expires and the token itself will have been
 *     refreshed with the correct (or absent) workspace claim.
 *
 * Key schema:  `ws-claim-revoked:{workspaceId}:{userId}`
 * TTL:          ACCESS_TOKEN_MAX_AGE (15 min)
 */

import { ACCESS_TOKEN_MAX_AGE } from '@/lib/auth/jwt-helpers';
import { getAuthRedis } from '@/lib/auth/redis';

const KEY_PREFIX = 'ws-claim-revoked';

/** Mark a user's workspace claim as revoked (call after role change or removal). */
export async function revokeWorkspaceClaim(
    workspaceId: string,
    userId: string,
): Promise<void> {
    const redis = await getAuthRedis();
    if (!redis) return; // Without Redis the claim TTL (15 min) provides a safe window

    try {
        await redis.setEx(
            `${KEY_PREFIX}:${workspaceId}:${userId}`,
            ACCESS_TOKEN_MAX_AGE, // matches the access-token max age exactly
            '1',
        );
    } catch {
        /* Non-fatal — the claim will be distrusted due to Redis being unavailable */
    }
}

/**
 * Returns true if the workspace claim for this user has been explicitly revoked.
 *
 * Conservative default: when Redis is unreachable, return `true` (revoked)
 * so the fast-path is skipped and we fall back to a DB membership check.
 */
export async function isWorkspaceClaimRevoked(
    workspaceId: string,
    userId: string,
): Promise<boolean> {
    const redis = await getAuthRedis();
    if (!redis) return true; // conservative: skip claim fast-path when Redis is down

    try {
        const val = await redis.get(`${KEY_PREFIX}:${workspaceId}:${userId}`);
        return val !== null;
    } catch {
        return true; // conservative
    }
}
