/**
 * @jest-environment node
 */
/**
 * Agent Auth Token Hashing — Unit Tests
 */

import {
    generateAgentToken,
    hashAgentToken,
    verifyAgentToken,
} from '@/lib/security/agent-auth';

describe('Agent Auth Token Hashing', () => {
    describe('generateAgentToken', () => {
        it('returns an object with plaintext and hash', () => {
            const token = generateAgentToken();
            expect(token.plaintext).toBeDefined();
            expect(token.hash).toBeDefined();
            expect(typeof token.plaintext).toBe('string');
            expect(typeof token.hash).toBe('string');
        });

        it('plaintext starts with the glanus_agent_ prefix', () => {
            const token = generateAgentToken();
            expect(token.plaintext).toMatch(/^glanus_agent_/);
        });

        it('hash is a valid 64-char hex string (HMAC-SHA-256)', () => {
            const token = generateAgentToken();
            expect(token.hash).toMatch(/^[a-f0-9]{64}$/);
        });

        it('generates unique tokens each time', () => {
            const t1 = generateAgentToken();
            const t2 = generateAgentToken();
            expect(t1.plaintext).not.toBe(t2.plaintext);
            expect(t1.hash).not.toBe(t2.hash);
        });
    });

    describe('hashAgentToken', () => {
        it('returns consistent hash for same input', () => {
            const input = 'test-token-value';
            expect(hashAgentToken(input)).toBe(hashAgentToken(input));
        });

        it('returns different hashes for different inputs', () => {
            expect(hashAgentToken('token-a')).not.toBe(hashAgentToken('token-b'));
        });
    });

    describe('verifyAgentToken', () => {
        it('returns true for matching token and hash', () => {
            const { plaintext, hash } = generateAgentToken();
            expect(verifyAgentToken(plaintext, hash)).toBe(true);
        });

        it('returns false for wrong plaintext', () => {
            const { hash } = generateAgentToken();
            expect(verifyAgentToken('wrong-token', hash)).toBe(false);
        });

        it('returns false for wrong hash', () => {
            const { plaintext } = generateAgentToken();
            const wrongHash = 'a'.repeat(64);
            expect(verifyAgentToken(plaintext, wrongHash)).toBe(false);
        });

        it('returns false for malformed hash (not hex)', () => {
            const { plaintext } = generateAgentToken();
            expect(verifyAgentToken(plaintext, 'not-a-valid-hex-hash')).toBe(false);
        });
    });
});
