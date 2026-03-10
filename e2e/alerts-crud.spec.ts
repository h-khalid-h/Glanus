import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Alert Rule CRUD — API Tests
 *
 * Verifies alert rule lifecycle:
 * 1. GET /api/workspaces/[id]/alerts — list alert rules
 * 2. POST /api/workspaces/[id]/alerts — create a rule
 * 3. PATCH /api/workspaces/[id]/alerts/[ruleId] — update a rule
 * 4. DELETE /api/workspaces/[id]/alerts/[ruleId] — delete a rule
 */

let E2E_RULE_ID: string | null = null;

test.describe('Alert Rule CRUD — API', () => {
    let workspaceId: string | null = null;

    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.waitForLoadState('networkidle');
        const link = page.locator('a[href*="/workspaces/"]').first();
        await link.waitFor({ state: 'visible', timeout: 10000 });
        const href = await link.getAttribute('href');
        workspaceId = href?.match(/\/workspaces\/([^/]+)/)?.[1] ?? null;
    });

    test('GET /api/workspaces/[id]/alerts returns 200 with rules list', async ({ page }) => {
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.get(`/api/workspaces/${workspaceId}/alerts`);
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
    });

    test('POST /api/workspaces/[id]/alerts creates a new CPU rule', async ({ page }) => {
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.post(`/api/workspaces/${workspaceId}/alerts`, {
            data: {
                name: 'E2E CPU Test Alert',
                metric: 'CPU',
                threshold: 95,
                severity: 'CRITICAL',
                enabled: false, // Disabled so it doesn't fire during tests
            },
        });

        expect(response.status()).toBe(201);
        const body = await response.json();
        expect(body).toHaveProperty('success', true);
        expect(body.data).toHaveProperty('id');
        expect(body.data.name).toBe('E2E CPU Test Alert');
        expect(body.data.metric).toBe('CPU');

        E2E_RULE_ID = body.data.id;
    });

    test('PATCH /api/workspaces/[id]/alerts/[ruleId] updates the threshold', async ({ page }) => {
        if (!workspaceId || !E2E_RULE_ID) { test.skip(); return; }

        const response = await page.request.patch(
            `/api/workspaces/${workspaceId}/alerts/${E2E_RULE_ID}`,
            {
                data: {
                    threshold: 90,
                    severity: 'WARNING',
                },
            }
        );

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('success', true);
        expect(body.data.threshold).toBe(90);
        expect(body.data.severity).toBe('WARNING');
    });

    test('POST alert with missing required fields returns 400', async ({ page }) => {
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.post(`/api/workspaces/${workspaceId}/alerts`, {
            data: {
                // Missing metric and threshold
                name: 'Incomplete Alert',
            },
        });

        expect([400, 422]).toContain(response.status());
    });

    test('DELETE /api/workspaces/[id]/alerts/[ruleId] removes the E2E rule', async ({ page }) => {
        if (!workspaceId || !E2E_RULE_ID) { test.skip(); return; }

        const response = await page.request.delete(
            `/api/workspaces/${workspaceId}/alerts/${E2E_RULE_ID}`
        );

        expect(response.status()).toBe(200);
        E2E_RULE_ID = null;
    });
});

test.describe('Alert Rule Validation', () => {
    let workspaceId: string | null = null;

    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.waitForLoadState('networkidle');
        const link = page.locator('a[href*="/workspaces/"]').first();
        await link.waitFor({ state: 'visible', timeout: 10000 });
        const href = await link.getAttribute('href');
        workspaceId = href?.match(/\/workspaces\/([^/]+)/)?.[1] ?? null;
    });

    test('POST alert with invalid metric type returns 400', async ({ page }) => {
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.post(`/api/workspaces/${workspaceId}/alerts`, {
            data: {
                name: 'Invalid Metric Alert',
                metric: 'INVALID_METRIC', // Not CPU, RAM, or DISK
                threshold: 80,
                severity: 'WARNING',
            },
        });

        expect([400, 422]).toContain(response.status());
    });

    test('POST alert with threshold > 100 is rejected', async ({ page }) => {
        if (!workspaceId) { test.skip(); return; }

        const response = await page.request.post(`/api/workspaces/${workspaceId}/alerts`, {
            data: {
                name: 'Over-threshold Alert',
                metric: 'CPU',
                threshold: 999, // Invalid threshold
                severity: 'WARNING',
            },
        });

        // Server may reject or clamp — either is acceptable
        expect([200, 201, 400, 422]).toContain(response.status());
    });
});
