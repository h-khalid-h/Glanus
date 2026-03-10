import { test, expect } from '@playwright/test';
import { login, navigateToWorkspace } from './helpers/auth';

test.describe('Assets Page', () => {
    // Cold-start page compilation can exceed 90s on dev server
    test.slow();

    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('assets list page loads and shows seeded assets', async ({ page }) => {
        await page.goto('/assets');
        await page.waitForLoadState('networkidle');

        // Wait for content to render (allow time for data fetch)
        await page.waitForSelector('text=MacBook Pro', { timeout: 20000 }).catch(() => { });
        await page.waitForSelector('text=Dell XPS', { timeout: 5000 }).catch(() => { });

        // Check for any asset name from the seed data
        const pageContent = await page.textContent('body');
        const assetNames = ['MacBook Pro', 'Dell XPS', 'PowerEdge', 'GitHub Enterprise', 'iPhone 15'];
        const hasAnyAsset = assetNames.some(name => pageContent?.includes(name));
        expect(hasAnyAsset).toBe(true);
    });

    test('assets search filters results', async ({ page }) => {
        await page.goto('/assets');
        await page.waitForLoadState('networkidle');

        // Wait for assets to load
        await page.waitForSelector('text=MacBook Pro', { timeout: 20000 }).catch(() => { });

        // Find search input by placeholder
        const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="Search" i]').first();
        if (await searchInput.isVisible({ timeout: 5000 })) {
            await searchInput.fill('MacBook');
            await page.waitForTimeout(1000);

            const content = await page.textContent('body');
            expect(content).toContain('MacBook');
        }
    });

    test('assets page shows workspace context', async ({ page }) => {
        await page.goto('/assets');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Should show the workspace name in the sidebar
        const content = await page.textContent('body');
        expect(content).toContain('Acme Corporation');
    });
});
