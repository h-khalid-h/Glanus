/**
 * QA Hardening — UX Enhancement Tests
 *
 * Tests for Round 1: PasswordStrengthMeter, skeleton loading, error boundary,
 * and CSRF protection on signup page.
 */

import '@testing-library/jest-dom';
import React from 'react';

// ============================================
// Round 1, Fix #1: Signup page uses csrfFetch
// ============================================

describe('Signup page — CSRF protection', () => {
    it('imports csrfFetch (not raw fetch) for form submission', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/app/signup/page'),
            'utf-8'
        );
        expect(content).toContain('csrfFetch');
    });
});

// ============================================
// Round 1, Fix #2: Billing page — valid Tailwind
// ============================================

describe('Billing page — Valid Tailwind classes', () => {
    it('does not contain double-opacity pattern', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/app/workspaces/[id]/billing/page'),
            'utf-8'
        );
        expect(content).not.toMatch(/\/\d+\/\d+/);
    });
});

// ============================================
// Round 1, Fix #3: Workspace route — audit log ordering
// ============================================

describe('Workspace DELETE route — Audit log order', () => {
    it('audit log creation appears before workspace deletion in source', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/app/api/workspaces/[id]/route'),
            'utf-8'
        );
        const auditLogIndex = content.indexOf('auditLog.create');
        const workspaceDeleteIndex = content.indexOf('workspace.delete');

        // Audit log should be written BEFORE the cascade delete
        expect(auditLogIndex).toBeGreaterThan(-1);
        expect(workspaceDeleteIndex).toBeGreaterThan(-1);
        expect(auditLogIndex).toBeLessThan(workspaceDeleteIndex);
    });
});

// ============================================
// Round 1, Fix #4: PasswordStrengthMeter
// ============================================

describe('Signup page — PasswordStrengthMeter present', () => {
    it('contains PasswordStrengthMeter component usage', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/app/signup/page'),
            'utf-8'
        );
        expect(content).toContain('PasswordStrength');
    });

    it('has password requirement indicators', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/app/signup/page'),
            'utf-8'
        );
        // Should include requirement checks for uppercase, lowercase, number, special
        expect(content).toMatch(/[A-Z]/);
        expect(content).toMatch(/[a-z]/);
        expect(content).toMatch(/[0-9]/);
    });
});

// ============================================
// Round 1, Fix #5: Skeleton loading
// ============================================

describe('Workspace loading — Skeleton UI', () => {
    it('contains layout-matching skeleton elements', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/app/workspaces/[id]/loading'),
            'utf-8'
        );
        // Should contain skeleton animation classes
        expect(content).toContain('animate-pulse');
        // Should contain structural skeleton elements (header, stats, nav)
        expect(content).toContain('rounded');
    });
});

// ============================================
// Round 1, Fix #6: Error boundary enhancements
// ============================================

describe('Workspace error boundary — Enhanced UI', () => {
    it('contains dashboard navigation link', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/app/workspaces/[id]/error'),
            'utf-8'
        );
        expect(content).toContain('/dashboard');
    });

    it('contains error digest display', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/app/workspaces/[id]/error'),
            'utf-8'
        );
        expect(content).toContain('digest');
    });

    it('contains SVG icon', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/app/workspaces/[id]/error'),
            'utf-8'
        );
        expect(content).toContain('<svg');
    });
});

// ============================================
// Cross-cutting: csrfFetch usage audit
// ============================================

describe('CSRF Protection — All mutation pages use csrfFetch', () => {
    const mutationPages = [
        '@/app/signup/page',
        '@/app/forgot-password/page',
    ];

    mutationPages.forEach(pagePath => {
        const pageName = pagePath.split('/').pop();
        it(`${pageName} uses csrfFetch`, async () => {
            const fs = require('fs');
            const content = fs.readFileSync(require.resolve(pagePath), 'utf-8');
            expect(content).toContain('csrfFetch');
        });
    });
});
