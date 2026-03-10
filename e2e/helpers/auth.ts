import { expect, Page } from '@playwright/test';

/**
 * Login helper — authenticates using the seeded admin account.
 *
 * The Glanus login page uses React controlled inputs (useState + onChange)
 * with NextAuth's signIn('credentials', { redirect: false }) → router.push('/dashboard').
 */
export async function login(page: Page, email = 'admin@glanus.com', password = 'password123') {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Wait for login form to be interactive
    const emailInput = page.locator('#email');
    await emailInput.waitFor({ state: 'visible', timeout: 20000 });

    // Clear and type to trigger React onChange events properly
    await emailInput.click();
    await emailInput.fill(email);

    const passwordInput = page.locator('#password');
    await passwordInput.click();
    await passwordInput.fill(password);

    // Submit — button says "Sign In"
    await page.click('button[type="submit"]');

    // Wait for redirect to /dashboard (30s for first-time cold-start compile)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
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
 * After login, extracts the first workspace ID from the dashboard link list.
 * Returns null if no workspace link can be found.
 */
export async function getWorkspaceId(page: Page): Promise<string | null> {
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href*="/workspaces/"]').first();
    await link.waitFor({ state: 'visible', timeout: 10000 }).catch(() => { });
    const href = await link.getAttribute('href').catch(() => null);
    return href?.match(/\/workspaces\/([^/]+)/)?.[1] ?? null;
}

/**
 * Login and navigate to the first workspace's analytics page.
 * Returns the workspaceId.
 */
export async function loginAndNavigateToWorkspace(page: Page): Promise<string | null> {
    await login(page);
    const workspaceId = await getWorkspaceId(page);
    if (workspaceId) {
        await page.goto(`/workspaces/${workspaceId}/analytics`);
        await page.waitForLoadState('networkidle');
    }
    return workspaceId;
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

// Re-export expect for convenience in spec files
export { expect };

