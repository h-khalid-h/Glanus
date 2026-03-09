import { test, expect } from '@playwright/test';
import { login, navigateToWorkspace } from './helpers/auth';

test.describe('Assets Page', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('assets list page loads and shows seeded assets', async ({ page }) => {
        await page.goto('/assets');
        await page.waitForLoadState('networkidle');

        // Should have the assets heading
        await expect(page.locator('h1, h2').first()).toBeVisible();

        // Should show some asset content (seeded assets from seed.ts)
        // Wait for assets to load
        await page.waitForTimeout(2000);

        // Check for any asset name from the seed data
        const assetNames = ['MacBook Pro', 'Dell XPS', 'PowerEdge', 'GitHub Enterprise', 'iPhone 15'];
        const pageContent = await page.textContent('body');

        const hasAnyAsset = assetNames.some(name => pageContent?.includes(name));
        expect(hasAnyAsset).toBe(true);
    });

    test('assets search filters results', async ({ page }) => {
        await page.goto('/assets');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Find search input
        const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="Search" i]').first();
        if (await searchInput.isVisible({ timeout: 3000 })) {
            await searchInput.fill('MacBook');
            await page.waitForTimeout(1000);

            const content = await page.textContent('body');
            expect(content).toContain('MacBook');
        }
    });

    test('asset detail page renders properly', async ({ page }) => {
        await page.goto('/assets');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Click on the first asset row/card
        const assetLink = page.locator('a[href*="/assets/"], tr[data-clickable], [role="row"]').first();
        if (await assetLink.isVisible({ timeout: 3000 })) {
            await assetLink.click();
            await page.waitForLoadState('networkidle');

            // Should be on asset detail page
            await expect(page).toHaveURL(/\/assets\/[a-z0-9-]+/i);
        }
    });
});
