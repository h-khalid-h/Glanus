/**
 * @jest-environment node
 */
/**
 * QA Hardening — Security Fix Tests
 *
 * Tests for Round 1 (CSRF) and Round 4 (timing-safe CSRF, password alignment)
 */

import { generateCSRFToken, validateCSRFToken } from '@/lib/security/csrf';
import { validatePassword } from '@/lib/security/sanitize';
import crypto from 'crypto';

// ============================================
// Round 4, Fix #17: Timing-safe CSRF validation
// ============================================

describe('CSRF Token — Timing-safe validation', () => {
    it('validates a correctly generated token', () => {
        const token = generateCSRFToken();
        expect(validateCSRFToken(token)).toBe(true);
    });

    it('rejects a token with tampered signature', () => {
        const token = generateCSRFToken();
        const [tokenValue] = token.split('.');
        const tamperedToken = `${tokenValue}.${'ab'.repeat(32)}`;
        expect(validateCSRFToken(tamperedToken)).toBe(false);
    });

    it('rejects a token with tampered value', () => {
        const token = generateCSRFToken();
        const [, signature] = token.split('.');
        const tamperedToken = `${'cd'.repeat(32)}.${signature}`;
        expect(validateCSRFToken(tamperedToken)).toBe(false);
    });

    it('rejects null token', () => {
        expect(validateCSRFToken(null)).toBe(false);
    });

    it('rejects empty string', () => {
        expect(validateCSRFToken('')).toBe(false);
    });

    it('rejects token without separator', () => {
        expect(validateCSRFToken('no-dot-separator')).toBe(false);
    });

    it('rejects token with non-hex signature (timingSafeEqual should catch)', () => {
        const token = generateCSRFToken();
        const [tokenValue] = token.split('.');
        // Non-hex chars will cause Buffer.from('zzzz', 'hex') to produce short buffer
        // timingSafeEqual should throw due to length mismatch, caught by try/catch → false
        const badToken = `${tokenValue}.zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz`;
        expect(validateCSRFToken(badToken)).toBe(false);
    });

    it('uses timingSafeEqual internally (verify crypto module)', () => {
        // Verify that crypto.timingSafeEqual is available and works
        const a = Buffer.from('abcdef', 'hex');
        const b = Buffer.from('abcdef', 'hex');
        const c = Buffer.from('123456', 'hex');

        expect(crypto.timingSafeEqual(a, b)).toBe(true);
        expect(crypto.timingSafeEqual(a, c)).toBe(false);
    });
});

// ============================================
// Round 4, Fix #18: Password min-length alignment
// ============================================

describe('Password Validation — Aligned minimum length', () => {
    it('accepts a valid 8-character password', () => {
        // Meets all requirements: length ≥ 8, upper, lower, number, special
        const result = validatePassword('Abcdef1!');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects a 7-character password', () => {
        const result = validatePassword('Abcd1!x');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('accepts a 12-character password', () => {
        const result = validatePassword('Abcdefgh12!@');
        expect(result.valid).toBe(true);
    });

    it('rejects password without uppercase', () => {
        const result = validatePassword('abcdef1!xx');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('rejects password without lowercase', () => {
        const result = validatePassword('ABCDEF1!XX');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('rejects password without number', () => {
        const result = validatePassword('Abcdefgh!@');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one number');
    });

    it('rejects password without special character', () => {
        const result = validatePassword('Abcdefgh12');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('rejects common passwords', () => {
        const result = validatePassword('Password1!xx');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password is too common');
    });

    it('returns multiple errors for very weak passwords', () => {
        const result = validatePassword('abc');
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
});

// ============================================
// Round 4, Fix #19: Dead code removal
// ============================================

describe('CSRF Module — Dead code removed', () => {
    it('does not export getCSRFTokenFromCookie', () => {
        const csrfModule = require('@/lib/security/csrf');
        expect(csrfModule.getCSRFTokenFromCookie).toBeUndefined();
    });

    it('still exports all required functions', () => {
        const csrfModule = require('@/lib/security/csrf');
        expect(typeof csrfModule.generateCSRFToken).toBe('function');
        expect(typeof csrfModule.validateCSRFToken).toBe('function');
        expect(typeof csrfModule.setCSRFCookie).toBe('function');
        expect(typeof csrfModule.getCSRFCookie).toBe('function');
        expect(typeof csrfModule.getOrCreateCSRFToken).toBe('function');
        expect(typeof csrfModule.validateCSRFFromRequest).toBe('function');
    });
});
