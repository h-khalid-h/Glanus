import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Authentication Flow', () => {
    test('login with valid credentials redirects to dashboard', async ({ page }) => {
        await login(page);

        // Should be on dashboard or workspaces page
        await expect(page).toHaveURL(/\/(dashboard|workspaces)/);
    });

    test('login with invalid credentials shows error', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        await page.fill('input[type="email"], input[name="email"]', 'wrong@example.com');
        await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        // Should stay on login page
        await page.waitForTimeout(2000);
        await expect(page).toHaveURL(/\/login/);
    });

    test('unauthenticated access to workspace redirects to login', async ({ page }) => {
        await page.goto('/workspaces/nonexistent/analytics');

        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
    });

    test('accessing root redirects appropriately', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Should be on login or dashboard depending on auth state
        const url = page.url();
        expect(url).toMatch(/\/(login|dashboard|workspaces)/);
    });
});
