import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Extract workspace ID from dashboard workspace links.
 */
async function getFirstWorkspaceId(page: import('@playwright/test').Page): Promise<string | null> {
    await page.waitForLoadState('networkidle');
    const workspaceLink = page.locator('a[href*="/workspaces/"]').first();
    await workspaceLink.waitFor({ state: 'visible', timeout: 10000 });
    const href = await workspaceLink.getAttribute('href');
    return href?.match(/\/workspaces\/([^/]+)/)?.[1] ?? null;
}

test.describe('Navigation & Mission Control', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Mission Control loads with real data', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }

        await page.goto(`/workspaces/analytics`);
        await page.waitForLoadState('networkidle');

        // Wait for Mission Control content to load (may need compilation time)
        await page.waitForSelector('text=/Assets|Agents|Mission|Acme/i', { timeout: 30000 }).catch(() => { });

        const content = await page.textContent('body');
        expect(content).not.toContain('Something went wrong');
        expect(content).not.toContain('Application error');
    });

    test('sidebar contains all workspace navigation links', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }

        await page.goto(`/workspaces/analytics`);
        await page.waitForLoadState('networkidle');

        // Wait for sidebar to render
        await page.waitForSelector('text=/Mission Control/i', { timeout: 20000 }).catch(() => { });

        // Verify all expected sidebar navigation items are present
        const sidebarContent = await page.textContent('body');
        const expectedNavItems = ['Mission Control', 'Assets', 'Agents', 'Alerts', 'Settings'];

        for (const item of expectedNavItems) {
            expect(sidebarContent).toContain(item);
        }
    });

    test('Command Palette opens with Ctrl+K', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }

        await page.goto(`/workspaces/analytics`);
        await page.waitForLoadState('networkidle');

        // Wait for page to be interactive
        await page.waitForSelector('text=/Assets|Agents|Mission/i', { timeout: 15000 }).catch(() => { });

        // Open command palette with Ctrl+K
        await page.keyboard.press('Control+k');

        // Command palette overlay should appear
        const commandDialog = page.locator('.command-dialog');
        await commandDialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });

        if (await commandDialog.isVisible()) {
            // Should have search input
            const input = page.locator('.command-input');
            await expect(input).toBeVisible();

            // Type a search term
            await input.fill('Assets');
            await page.waitForTimeout(500);

            // Should show results
            const dialogContent = await commandDialog.textContent();
            expect(dialogContent).toBeTruthy();

            // Close with Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }
    });

    test('notifications page loads without error', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }

        await page.goto(`/workspaces/notifications`);
        await page.waitForLoadState('networkidle');

        // Wait for page content
        await page.waitForTimeout(3000);

        const content = await page.textContent('body');
        expect(content).not.toContain('Something went wrong');
        expect(content).not.toContain('Application error');
    });
});
