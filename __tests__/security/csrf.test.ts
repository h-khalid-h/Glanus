/**
 * Critical Path Tests — CSRF Token
 */

import { generateCSRFToken, validateCSRFToken } from '@/lib/security/csrf';

describe('CSRF Token', () => {
    describe('generateCSRFToken', () => {
        it('generates a token with format token.signature', () => {
            const token = generateCSRFToken();
            const parts = token.split('.');

            expect(parts).toHaveLength(2);
            expect(parts[0].length).toBe(96); // 48 bytes = 96 hex chars
            expect(parts[1].length).toBe(64); // SHA-256 = 64 hex chars
        });

        it('generates unique tokens', () => {
            const token1 = generateCSRFToken();
            const token2 = generateCSRFToken();

            expect(token1).not.toBe(token2);
        });
    });

    describe('validateCSRFToken', () => {
        it('validates a correctly generated token', () => {
            const token = generateCSRFToken();
            expect(validateCSRFToken(token)).toBe(true);
        });

        it('rejects null token', () => {
            expect(validateCSRFToken(null)).toBe(false);
        });

        it('rejects empty string', () => {
            expect(validateCSRFToken('')).toBe(false);
        });

        it('rejects token without separator', () => {
            expect(validateCSRFToken('invalid-token-no-dot')).toBe(false);
        });

        it('rejects tampered token', () => {
            const token = generateCSRFToken();
            const [tokenValue] = token.split('.');
            const tamperedToken = `${tokenValue}.invalidsignature`;

            expect(validateCSRFToken(tamperedToken)).toBe(false);
        });

        it('rejects token with modified value', () => {
            const token = generateCSRFToken();
            const [, signature] = token.split('.');
            const tamperedToken = `${'a'.repeat(64)}.${signature}`;

            expect(validateCSRFToken(tamperedToken)).toBe(false);
        });
    });
});
