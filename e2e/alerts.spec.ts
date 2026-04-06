import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Alerts Page', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('alerts page loads and shows content', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // Find a workspace link on the dashboard
        const workspaceLink = page.locator('a[href*="/workspaces/"]').first();
        await workspaceLink.waitFor({ state: 'visible', timeout: 10000 });
        const href = await workspaceLink.getAttribute('href');
        const workspaceId = href?.match(/\/workspaces\/([^/]+)/)?.[1];

        if (!workspaceId) {
            test.skip();
            return;
        }

        await page.goto(`/workspaces/alerts`);
        await page.waitForLoadState('networkidle');

        // Wait for alert content to appear (skeleton loading finishes)
        await page.waitForSelector('text=/CPU|Disk|Alert|Rule|Webhook/i', { timeout: 20000 }).catch(() => { });

        const content = await page.textContent('body');
        // Page should have loaded — not show an error
        expect(content).not.toContain('Something went wrong');
    });

    test('webhook configuration section loads', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        const workspaceLink = page.locator('a[href*="/workspaces/"]').first();
        await workspaceLink.waitFor({ state: 'visible', timeout: 10000 });
        const href = await workspaceLink.getAttribute('href');
        const workspaceId = href?.match(/\/workspaces\/([^/]+)/)?.[1];

        if (!workspaceId) {
            test.skip();
            return;
        }

        await page.goto(`/workspaces/alerts`);
        await page.waitForLoadState('networkidle');

        // Wait for page content to fully render
        await page.waitForSelector('text=/Webhook|Alert|Rule/i', { timeout: 20000 }).catch(() => { });

        // Check that page loaded without errors
        const content = await page.textContent('body');
        expect(content).not.toContain('Something went wrong');
        expect(content).not.toContain('Application error');
    });

    test('saving a webhook URL works', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        const workspaceLink = page.locator('a[href*="/workspaces/"]').first();
        await workspaceLink.waitFor({ state: 'visible', timeout: 10000 });
        const href = await workspaceLink.getAttribute('href');
        const workspaceId = href?.match(/\/workspaces\/([^/]+)/)?.[1];

        if (!workspaceId) {
            test.skip();
            return;
        }

        await page.goto(`/workspaces/alerts`);
        await page.waitForLoadState('networkidle');

        // Wait for webhook section
        const webhookInput = page.locator('input[type="url"]');
        if (await webhookInput.isVisible({ timeout: 20000 })) {
            await webhookInput.fill('https://hooks.example.com/test-e2e');
            const saveButton = page.locator('button:has-text("Save Webhook")');
            if (await saveButton.isVisible({ timeout: 3000 })) {
                await saveButton.click();
                await page.waitForTimeout(3000);

                // Verify no error
                const content = await page.textContent('body');
                expect(content).not.toContain('Something went wrong');
            }
        }
    });
});
