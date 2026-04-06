import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Full workspace page coverage — verifies every workspace page
 * loads without errors. Each page may take 30-60s on first compilation
 * in dev mode, so we use error-absence assertions only.
 */

/**
 * Navigate to a workspace page and verify it loads without errors.
 * Returns false if the page couldn't load (browser crash on cold compile).
 */
async function verifyPageLoads(
    page: import('@playwright/test').Page,
    path: string,
    contentHint: RegExp
): Promise<boolean> {
    try {
        await page.goto(`/workspaces/${path}`);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector(`text=${contentHint.source}`, { timeout: 30000 }).catch(() => { });

        const content = await page.textContent('body');
        expect(content).not.toContain('Something went wrong');
        expect(content).not.toContain('Application error');
        return true;
    } catch {
        // Browser context may crash on very slow cold-start compilation
        return false;
    }
}

test.describe('Workspace Pages — Full Coverage', () => {
    // Triple timeout (90s → 270s) — cold-start page compilation takes 60-90s on dev server
    test.slow();

    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('agents page loads', async ({ page }) => {
        const loaded = await verifyPageLoads(page, 'agents', /Agent|Online|Offline/i);
        expect(loaded).toBe(true);
    });

    test('members page loads', async ({ page }) => {
        const loaded = await verifyPageLoads(page, 'members', /Member|Admin|Team/i);
        expect(loaded).toBe(true);
    });

    test('audit logs page loads', async ({ page }) => {
        const loaded = await verifyPageLoads(page, 'audit', /Audit|Log|Activity/i);
        expect(loaded).toBe(true);
    });

    test('settings page loads', async ({ page }) => {
        const loaded = await verifyPageLoads(page, 'settings', /Settings|Workspace/i);
        expect(loaded).toBe(true);
    });

    test('billing page loads', async ({ page }) => {
        const loaded = await verifyPageLoads(page, 'billing', /Billing|Plan|Subscription/i);
        expect(loaded).toBe(true);
    });

    test('intelligence page loads', async ({ page }) => {
        const loaded = await verifyPageLoads(page, 'intelligence', /Intelligence|Insight|AI/i);
        expect(loaded).toBe(true);
    });

    test('MDM profiles page loads', async ({ page }) => {
        const loaded = await verifyPageLoads(page, 'mdm', /MDM|Profile|Device/i);
        expect(loaded).toBe(true);
    });

    test('reflex engine page loads', async ({ page }) => {
        const loaded = await verifyPageLoads(page, 'reflex', /Reflex|Automation|Rule/i);
        expect(loaded).toBe(true);
    });

    test('reports page loads', async ({ page }) => {
        const loaded = await verifyPageLoads(page, 'reports', /Report|Export|Download/i);
        expect(loaded).toBe(true);
    });

    test('partner page loads', async ({ page }) => {
        const loaded = await verifyPageLoads(page, 'partner', /Partner|IT|MSP/i);
        expect(loaded).toBe(true);
    });

    test('download agent page loads', async ({ page }) => {
        const loaded = await verifyPageLoads(page, 'download-agent', /Download|Agent|Install/i);
        expect(loaded).toBe(true);
    });
});

