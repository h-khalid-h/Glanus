/**
 * Agent Authentication — Token Hashing
 *
 * Agent authTokens are stored as HMAC-SHA-256 hashes in the database.
 * The plaintext token is returned to the agent only on registration.
 * Subsequent authentication compares against the stored hash.
 *
 * Note: HMAC-SHA-256 (rather than bcrypt) is appropriate here because agent
 * tokens are 256-bit cryptographically random values that cannot be brute-forced.
 * Using HMAC with a server secret prevents pre-computed rainbow table attacks
 * and allows O(1) database lookups by hash.
 */

import crypto from 'crypto';

function getHmacSecret(): string {
    const secret = process.env.AGENT_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
        throw new Error('AGENT_TOKEN_SECRET or NEXTAUTH_SECRET must be configured');
    }
    return secret;
}

/**
 * Generate a new agent token.
 * Returns both the plaintext (to give to the agent) and the hash (to store).
 */
export function generateAgentToken(): { plaintext: string; hash: string } {
    const plaintext = `glanus_agent_${crypto.randomBytes(32).toString('hex')}`;
    const hash = hashAgentToken(plaintext);
    return { plaintext, hash };
}

/**
 * Hash an agent token for storage using HMAC-SHA-256 with server secret.
 */
export function hashAgentToken(plaintext: string): string {
    return crypto
        .createHmac('sha256', getHmacSecret())
        .update(plaintext)
        .digest('hex');
}

/**
 * Verify an agent token against its stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyAgentToken(plaintext: string, storedHash: string): boolean {
    const candidateHash = hashAgentToken(plaintext);
    try {
        return crypto.timingSafeEqual(
            Buffer.from(candidateHash, 'hex'),
            Buffer.from(storedHash, 'hex')
        );
    } catch {
        return false;
    }
}
