import { test, expect } from '@playwright/test';
import { login, getCSRFToken } from './helpers/auth';

/**
 * Workspace Settings & Members — API Tests
 *
 * Covers the workspace management API surface:
 * - GET workspace details
 * - GET member list
 * - POST invite member (with validation)
 * - GET invitations
 */

test.describe('Workspace Settings — API', () => {
    let workspaceId: string | null = null;

    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.waitForLoadState('networkidle');
        const link = page.locator('a[href*="/workspaces/"]').first();
        await link.waitFor({ state: 'visible', timeout: 30000 });
        const href = await link.getAttribute('href');
        workspaceId = href?.match(/\/workspaces\/([^/]+)/)?.[1] ?? null;
    });

    test('GET /api/workspaces/[id] returns workspace details', async ({ page }) => {
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.get(`/api/workspaces/${workspaceId}`);
        expect(response.status()).toBe(200);
        const body = await response.json();
        console.log("WORKSPACE DETAILS BODY:", body);
        expect(body).toHaveProperty('success', true);
        expect(body.data.workspace).toHaveProperty('id', workspaceId);
        expect(body.data.workspace).toHaveProperty('name');
    });

    test('GET /api/workspaces/[id]/members returns member list', async ({ page }) => {
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.get(`/api/workspaces/${workspaceId}/members`);
        expect(response.status()).toBe(200);
        const body = await response.json();
        console.log("MEMBER LIST BODY:", body);
        expect(body).toHaveProperty('success', true);
        expect(Array.isArray(body.data.members)).toBe(true);
        // Should always have at least the owner
        expect(body.data.members.length).toBeGreaterThan(0);
    });

    test('GET /api/workspaces/[id]/invitations returns invitation list', async ({ page }) => {
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.get(`/api/workspaces/${workspaceId}/invitations`);
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('success', true);
    });

    test('POST /api/workspaces/[id]/invitations with invalid email returns 400', async ({ page }) => {
        if (!workspaceId) { test.skip(); return; }

        const csrfToken = await getCSRFToken(page);
        const response = await page.request.post(`/api/workspaces/${workspaceId}/invitations`, {
            headers: { 'x-csrf-token': csrfToken || '' },
            data: {
                email: 'not-a-valid-email',
                role: 'MEMBER',
            },
        });

        expect([400, 422]).toContain(response.status());
    });

    test('PATCH /api/workspaces/[id] with valid name updates workspace', async ({ page }) => {
        if (!workspaceId) { test.skip(); return; }

        // Get current name first
        const getResp = await page.request.get(`/api/workspaces/${workspaceId}`);
        const originalName = (await getResp.json()).data?.name;

        const csrfToken = await getCSRFToken(page);
        const response = await page.request.patch(`/api/workspaces/${workspaceId}`, {
            headers: { 'x-csrf-token': csrfToken || '' },
            data: { name: originalName }, // Same name — just verify it accepts it
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('success', true);
    });
});

test.describe('Workspace Settings — UI', () => {
    test.slow();

    test('Settings page shows workspace name and danger zone', async ({ page }) => {
        await login(page);
        await page.waitForLoadState('networkidle');

        const link = page.locator('a[href*="/workspaces/"]').first();
        await link.waitFor({ state: 'visible', timeout: 10000 });
        const href = await link.getAttribute('href');
        const workspaceId = href?.match(/\/workspaces\/([^/]+)/)?.[1];
        if (!workspaceId) { test.skip(); return; }

        await page.goto(`/workspaces/settings`);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('text=/Settings|Workspace|General/i', { timeout: 20000 }).catch(() => { });

        const content = await page.textContent('body');
        expect(content).not.toContain('Something went wrong');
        expect(content).not.toContain('Application error');
        // Settings page should show workspace name
        expect(content).toContain('Acme Corporation');
    });

    test('Members page shows member list', async ({ page }) => {
        await login(page);
        await page.waitForLoadState('networkidle');

        const link = page.locator('a[href*="/workspaces/"]').first();
        await link.waitFor({ state: 'visible', timeout: 10000 });
        const href = await link.getAttribute('href');
        const workspaceId = href?.match(/\/workspaces\/([^/]+)/)?.[1];
        if (!workspaceId) { test.skip(); return; }

        await page.goto(`/workspaces/members`);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('text=/Member|Admin|Owner|Team/i', { timeout: 20000 }).catch(() => { });

        const content = await page.textContent('body');
        expect(content).not.toContain('Something went wrong');
        // Should show at least the admin account
        expect(content).toContain('admin');
    });
});
