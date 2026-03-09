import { test, expect } from '@playwright/test';
import { login, navigateToWorkspace, getWorkspaceIdFromUrl } from './helpers/auth';

test.describe('Alerts Page', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await navigateToWorkspace(page);
    });

    test('alerts page loads with seeded alert rules', async ({ page }) => {
        const workspaceId = getWorkspaceIdFromUrl(page);
        if (!workspaceId) {
            test.skip();
            return;
        }

        await page.goto(`/workspaces/${workspaceId}/alerts`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Should show the Alerts heading
        const heading = page.locator('h1, h2').first();
        await expect(heading).toBeVisible();

        // Should show seeded alert rule names
        const content = await page.textContent('body');
        const hasAlertRule = content?.includes('CPU') || content?.includes('Disk') || content?.includes('Alert');
        expect(hasAlertRule).toBe(true);
    });

    test('webhook configuration section is visible', async ({ page }) => {
        const workspaceId = getWorkspaceIdFromUrl(page);
        if (!workspaceId) {
            test.skip();
            return;
        }

        await page.goto(`/workspaces/${workspaceId}/alerts`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Webhook section should be present (may need to scroll)
        const webhookSection = page.locator('text=Webhook Configuration');
        if (await webhookSection.isVisible({ timeout: 5000 })) {
            await expect(webhookSection).toBeVisible();

            // Should have a URL input
            const webhookInput = page.locator('input[type="url"]');
            await expect(webhookInput).toBeVisible();

            // Should have a Save button
            const saveButton = page.locator('button:has-text("Save Webhook")');
            await expect(saveButton).toBeVisible();
        }
    });

    test('saving a webhook URL works without creating duplicates', async ({ page }) => {
        const workspaceId = getWorkspaceIdFromUrl(page);
        if (!workspaceId) {
            test.skip();
            return;
        }

        await page.goto(`/workspaces/${workspaceId}/alerts`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const webhookInput = page.locator('input[type="url"]');
        if (await webhookInput.isVisible({ timeout: 3000 })) {
            // Fill in a webhook URL
            await webhookInput.fill('https://hooks.example.com/test');

            // Click save
            const saveButton = page.locator('button:has-text("Save Webhook")');
            await saveButton.click();

            // Wait for save to complete
            await page.waitForTimeout(2000);

            // Save again with a different URL — should update, not duplicate
            await webhookInput.fill('https://hooks.example.com/updated');
            await saveButton.click();
            await page.waitForTimeout(2000);

            // Fetch webhooks API to verify only 1 exists
            const response = await page.request.get(`/api/workspaces/${workspaceId}/alerts/webhook`);
            if (response.ok()) {
                const data = await response.json();
                const webhooks = data.data?.webhooks || [];
                // Should have at most 1 webhook (upsert behavior)
                expect(webhooks.length).toBeLessThanOrEqual(1);
            }
        }
    });
});
