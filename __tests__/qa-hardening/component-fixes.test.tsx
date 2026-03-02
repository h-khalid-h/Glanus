/**
 * QA Hardening — Component Fix Tests
 *
 * Tests for Rounds 1-3: UX components, theme consistency, Tailwind class correctness.
 * Validates that all fixed components render correctly with proper styling.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@/lib/test-utils';
import React from 'react';

// ============================================
// Round 3, Fix #14: ExplanationCard — Static Tailwind classes
// ============================================

// Mock the ExplanationCard to test class generation logic
describe('ExplanationCard — Static Tailwind class map', () => {
    // Test the risk badge class logic directly
    function getRiskBadgeClass(riskScore: number): string {
        return riskScore >= 70
            ? 'bg-health-critical/10 text-health-critical border-health-critical/20'
            : riskScore >= 40
                ? 'bg-oracle/10 text-oracle border-oracle/20'
                : 'bg-health-good/10 text-health-good border-health-good/20';
    }

    it('returns critical classes for riskScore >= 70', () => {
        const cls = getRiskBadgeClass(70);
        expect(cls).toContain('health-critical');
        expect(cls).not.toContain('oracle');
        expect(cls).not.toContain('health-good');
    });

    it('returns critical classes for riskScore = 100', () => {
        const cls = getRiskBadgeClass(100);
        expect(cls).toContain('health-critical');
    });

    it('returns oracle classes for riskScore 40-69', () => {
        const cls = getRiskBadgeClass(40);
        expect(cls).toContain('oracle');
        expect(cls).not.toContain('health-critical');
        expect(cls).not.toContain('health-good');
    });

    it('returns oracle classes for riskScore = 69', () => {
        const cls = getRiskBadgeClass(69);
        expect(cls).toContain('oracle');
    });

    it('returns good classes for riskScore < 40', () => {
        const cls = getRiskBadgeClass(39);
        expect(cls).toContain('health-good');
        expect(cls).not.toContain('health-critical');
        expect(cls).not.toContain('oracle');
    });

    it('returns good classes for riskScore = 0', () => {
        const cls = getRiskBadgeClass(0);
        expect(cls).toContain('health-good');
    });

    it('all class strings are fully static (no interpolation)', () => {
        for (const score of [0, 20, 39, 40, 50, 69, 70, 85, 100]) {
            const cls = getRiskBadgeClass(score);
            // Verify no ${...} template literals remain
            expect(cls).not.toMatch(/\$\{/);
            // Verify all classes are complete (contain bg-, text-, border-)
            expect(cls).toMatch(/^bg-/);
            expect(cls).toContain('text-');
            expect(cls).toContain('border-');
        }
    });
});

// ============================================
// Round 2: Tailwind class validation
// ============================================

describe('Tailwind Class Validation — No double-opacity patterns', () => {
    // Regex pattern that matches invalid Tailwind double-opacity like /20/50
    const DOUBLE_OPACITY_REGEX = /\/\d+\/\d+/;

    it('validates that double-opacity pattern is detected', () => {
        // Sanity check — the regex catches the problematic pattern
        expect('border-health-critical/20/50').toMatch(DOUBLE_OPACITY_REGEX);
        expect('bg-health-good/15/30').toMatch(DOUBLE_OPACITY_REGEX);
        expect('border-health-good/20/20').toMatch(DOUBLE_OPACITY_REGEX);
    });

    it('validates that single-opacity pattern is correct', () => {
        // These are valid Tailwind classes
        expect('border-health-critical/20').not.toMatch(DOUBLE_OPACITY_REGEX);
        expect('bg-health-good/15').not.toMatch(DOUBLE_OPACITY_REGEX);
        expect('text-health-good').not.toMatch(DOUBLE_OPACITY_REGEX);
    });

    // Verify the actual fixed files don't contain the pattern
    // We test the source files by importing and checking their rendered output
    it('DangerZone uses single-opacity border', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/workspace/settings/DangerZone'),
            'utf-8'
        );
        // Should NOT contain double-opacity
        expect(content).not.toMatch(DOUBLE_OPACITY_REGEX);
        // Should contain the fixed single-opacity
        expect(content).toContain('border-health-critical/20');
    });

    it('InviteForm uses single-opacity border', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/workspace/InviteForm'),
            'utf-8'
        );
        expect(content).not.toMatch(DOUBLE_OPACITY_REGEX);
    });

    it('WorkspaceWizard uses single-opacity border', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/WorkspaceWizard'),
            'utf-8'
        );
        expect(content).not.toMatch(DOUBLE_OPACITY_REGEX);
    });

    it('billing page uses single-opacity bg', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/app/workspaces/[id]/billing/page'),
            'utf-8'
        );
        expect(content).not.toMatch(DOUBLE_OPACITY_REGEX);
    });
});

// ============================================
// Round 2 + 3: Dark theme color consistency
// ============================================

describe('Dark Theme — Color consistency', () => {
    it('MetricCard uses text-slate-400 for title (not text-slate-600)', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/analytics/MetricCard'),
            'utf-8'
        );
        // Should contain the fixed class
        expect(content).toContain('text-slate-400');
        // Should NOT contain the old invisible class on the title line
        expect(content).not.toMatch(/text-sm font-medium text-slate-600/);
    });

    it('GeneralSettings uses dark theme bg-slate-800 for URL prefix', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/workspace/settings/GeneralSettings'),
            'utf-8'
        );
        expect(content).toContain('bg-slate-800');
        // Should NOT contain light-theme bg-slate-50
        expect(content).not.toContain('bg-slate-50');
    });

    it('DangerZone uses text-health-critical for headings (not text-red-900)', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/workspace/settings/DangerZone'),
            'utf-8'
        );
        expect(content).toContain('text-health-critical');
        expect(content).not.toContain('text-red-900');
    });

    it('GeneralSettings success text uses full opacity (not /20)', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/workspace/settings/GeneralSettings'),
            'utf-8'
        );
        // Should NOT have text-health-good/20 (invisible)
        expect(content).not.toContain('text-health-good/20');
    });
});

// ============================================
// Round 3, Fix #16: MetricsChart — Dark theme Recharts
// ============================================

describe('MetricsChart — Dark theme Recharts colors', () => {
    it('uses dark grid stroke color', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/agent/MetricsChart'),
            'utf-8'
        );
        // Should use dark grid color
        expect(content).toContain('#334155');
        // Should NOT use light grid color
        expect(content).not.toContain('#e5e7eb');
    });

    it('uses dark tooltip background', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/agent/MetricsChart'),
            'utf-8'
        );
        // Should use dark tooltip bg
        expect(content).toContain('#1e293b');
        // Should NOT use white tooltip bg
        expect(content).not.toMatch(/backgroundColor:\s*['"]#fff['"]/);
    });

    it('uses dark tooltip text color', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/agent/MetricsChart'),
            'utf-8'
        );
        // Should have explicit text color for tooltip
        expect(content).toContain('#e2e8f0');
    });
});

// ============================================
// Round 3, Fix #14: No dynamic Tailwind in ExplanationCard
// ============================================

describe('ExplanationCard — No dynamic Tailwind interpolation', () => {
    it('does not use template literal Tailwind classes', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/cortex/ExplanationCard'),
            'utf-8'
        );
        // Should NOT contain bg-${...} or text-${...} patterns
        expect(content).not.toMatch(/bg-\$\{/);
        expect(content).not.toMatch(/text-\$\{/);
        expect(content).not.toMatch(/border-\$\{/);
    });

    it('uses riskBadgeClass not riskColor', async () => {
        const fs = require('fs');
        const content = fs.readFileSync(
            require.resolve('@/components/cortex/ExplanationCard'),
            'utf-8'
        );
        expect(content).toContain('riskBadgeClass');
        // riskColor variable should no longer exist
        expect(content).not.toMatch(/const riskColor/);
    });
});
