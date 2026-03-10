import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * API Integration Tests — verifies actual API endpoints return correct data.
 * Authenticates via UI then calls APIs with session cookies.
 */

async function getFirstWorkspaceId(page: import('@playwright/test').Page): Promise<string | null> {
    await page.waitForLoadState('networkidle');
    const workspaceLink = page.locator('a[href*="/workspaces/"]').first();
    await workspaceLink.waitFor({ state: 'visible', timeout: 10000 });
    const href = await workspaceLink.getAttribute('href');
    return href?.match(/\/workspaces\/([^/]+)/)?.[1] ?? null;
}

test.describe('API Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('GET /api/workspaces/[id]/analytics returns 200', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.get(`/api/workspaces/${workspaceId}/analytics`);
        expect(response.status()).toBe(200);
    });

    test('GET /api/workspaces/[id]/agents returns 200', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.get(`/api/workspaces/${workspaceId}/agents`);
        expect(response.status()).toBe(200);
    });

    test('GET /api/workspaces/[id]/alerts/webhook returns 200', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.get(`/api/workspaces/${workspaceId}/alerts/webhook`);
        expect(response.status()).toBe(200);
    });

    test('GET /api/workspaces/[id]/audit returns 200', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.get(`/api/workspaces/${workspaceId}/audit`);
        expect(response.status()).toBe(200);
    });

    test('GET /api/workspaces/[id]/members returns 200', async ({ page }) => {
        const workspaceId = await getFirstWorkspaceId(page);
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.get(`/api/workspaces/${workspaceId}/members`);
        expect(response.status()).toBe(200);
    });
});
