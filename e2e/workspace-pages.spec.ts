import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Full workspace page coverage — verifies every workspace page
 * loads without errors. Each page may take 30-60s on first compilation
 * in dev mode, so we use error-absence assertions only.
 */

async function getFirstWorkspaceId(page: import('@playwright/test').Page): Promise<string | null> {
    await page.waitForLoadState('networkidle');
    const workspaceLink = page.locator('a[href*="/workspaces/"]').first();
    await workspaceLink.waitFor({ state: 'visible', timeout: 10000 });
    const href = await workspaceLink.getAttribute('href');
    return href?.match(/\/workspaces\/([^/]+)/)?.[1] ?? null;
}

/**
 * Navigate to a workspace page and verify it loads without errors.
 * Returns false if the page couldn't load (browser crash on cold compile).
 */
async function verifyPageLoads(
    page: import('@playwright/test').Page,
    workspaceId: string,
    path: string,
    contentHint: RegExp
): Promise<boolean> {
    try {
        await page.goto(`/workspaces/${workspaceId}/${path}`);
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
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }
        const loaded = await verifyPageLoads(page, workspaceId, 'agents', /Agent|Online|Offline/i);
        expect(loaded).toBe(true);
    });

    test('members page loads', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }
        const loaded = await verifyPageLoads(page, workspaceId, 'members', /Member|Admin|Team/i);
        expect(loaded).toBe(true);
    });

    test('audit logs page loads', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }
        const loaded = await verifyPageLoads(page, workspaceId, 'audit', /Audit|Log|Activity/i);
        expect(loaded).toBe(true);
    });

    test('settings page loads', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }
        const loaded = await verifyPageLoads(page, workspaceId, 'settings', /Settings|Workspace/i);
        expect(loaded).toBe(true);
    });

    test('billing page loads', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }
        const loaded = await verifyPageLoads(page, workspaceId, 'billing', /Billing|Plan|Subscription/i);
        expect(loaded).toBe(true);
    });

    test('intelligence page loads', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }
        const loaded = await verifyPageLoads(page, workspaceId, 'intelligence', /Intelligence|Insight|AI/i);
        expect(loaded).toBe(true);
    });

    test('MDM profiles page loads', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }
        const loaded = await verifyPageLoads(page, workspaceId, 'mdm', /MDM|Profile|Device/i);
        expect(loaded).toBe(true);
    });

    test('reflex engine page loads', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }
        const loaded = await verifyPageLoads(page, workspaceId, 'reflex', /Reflex|Automation|Rule/i);
        expect(loaded).toBe(true);
    });

    test('reports page loads', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }
        const loaded = await verifyPageLoads(page, workspaceId, 'reports', /Report|Export|Download/i);
        expect(loaded).toBe(true);
    });

    test('partner page loads', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }
        const loaded = await verifyPageLoads(page, workspaceId, 'partner', /Partner|IT|MSP/i);
        expect(loaded).toBe(true);
    });

    test('download agent page loads', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }
        const loaded = await verifyPageLoads(page, workspaceId, 'download-agent', /Download|Agent|Install/i);
        expect(loaded).toBe(true);
    });
});
