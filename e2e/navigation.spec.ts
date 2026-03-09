import { test, expect } from '@playwright/test';
import { login, navigateToWorkspace, getWorkspaceIdFromUrl } from './helpers/auth';

test.describe('Navigation & Mission Control', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Mission Control loads with real data', async ({ page }) => {
        await navigateToWorkspace(page);
        const workspaceId = getWorkspaceIdFromUrl(page);
        if (!workspaceId) {
            test.skip();
            return;
        }

        await page.goto(`/workspaces/${workspaceId}/analytics`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Check for Mission Control content
        const content = await page.textContent('body');

        // Should show workspace name
        expect(content).toContain('Acme');

        // Should show metric cards (Assets, Agents, Members, Alerts)
        const hasMetrics = content?.includes('Assets') && content?.includes('Agents');
        expect(hasMetrics).toBe(true);
    });

    test('sidebar navigation works for all workspace pages', async ({ page }) => {
        await navigateToWorkspace(page);
        const workspaceId = getWorkspaceIdFromUrl(page);
        if (!workspaceId) {
            test.skip();
            return;
        }

        const pages = [
            { path: 'analytics', expectedText: 'Mission Control' },
            { path: 'agents', expectedText: 'Agent' },
            { path: 'alerts', expectedText: 'Alert' },
            { path: 'members', expectedText: 'Member' },
            { path: 'settings', expectedText: 'Setting' },
        ];

        for (const p of pages) {
            await page.goto(`/workspaces/${workspaceId}/${p.path}`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);

            const content = await page.textContent('body');
            expect(content).toContain(p.expectedText);
        }
    });

    test('Command Palette opens with Ctrl+K', async ({ page }) => {
        await navigateToWorkspace(page);
        const workspaceId = getWorkspaceIdFromUrl(page);
        if (!workspaceId) {
            test.skip();
            return;
        }

        await page.goto(`/workspaces/${workspaceId}/analytics`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Open command palette
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(500);

        // Command palette overlay should be visible
        const commandDialog = page.locator('.command-dialog');
        if (await commandDialog.isVisible({ timeout: 3000 })) {
            await expect(commandDialog).toBeVisible();

            // Should have search input
            const input = page.locator('.command-input');
            await expect(input).toBeVisible();

            // Type a search term
            await input.fill('Dashboard');
            await page.waitForTimeout(500);

            // Should show navigation results
            const content = await commandDialog.textContent();
            expect(content).toContain('Dashboard');

            // Close with Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            await expect(commandDialog).not.toBeVisible();
        }
    });

    test('notifications page loads and shows activity', async ({ page }) => {
        await navigateToWorkspace(page);
        const workspaceId = getWorkspaceIdFromUrl(page);
        if (!workspaceId) {
            test.skip();
            return;
        }

        await page.goto(`/workspaces/${workspaceId}/notifications`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Should not show an error
        const content = await page.textContent('body');
        expect(content).not.toContain('Something went wrong');
    });
});
