import { test as base, expect, Page } from '@playwright/test';

/**
 * Login helper — authenticates using the seeded admin account.
 * Stores session state so subsequent tests skip the login step.
 */
export async function login(page: Page, email = 'admin@glanus.com', password = 'password123') {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill credentials
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

/**
 * Get the workspace ID from the current URL.
 * Expects the user to be on a /workspaces/[id]/... page.
 */
export function getWorkspaceIdFromUrl(page: Page): string | null {
    const match = page.url().match(/\/workspaces\/([^/]+)/);
    return match ? match[1] : null;
}

/**
 * Navigate to the first workspace's analytics (Mission Control) page.
 */
export async function navigateToWorkspace(page: Page) {
    // After login, user should be on /dashboard
    // Click on the first workspace card to navigate
    const workspaceLink = page.locator('a[href*="/workspaces/"]').first();
    if (await workspaceLink.isVisible({ timeout: 5000 })) {
        await workspaceLink.click();
        await page.waitForLoadState('networkidle');
    }
}
