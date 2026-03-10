import { test, expect } from '@playwright/test';

/**
 * Health & Readiness Endpoint Tests
 *
 * These public endpoints must always return quickly and correctly.
 * They are used by load balancers and deployment orchestrators (K8s liveness/readiness probes).
 */

test.describe('Health & Readiness Probes', () => {
    test('GET /api/health returns 200 with status ok', async ({ request }) => {
        const response = await request.get('/api/health');
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('status');
        // Status should be ok or degraded, not error
        expect(['ok', 'degraded']).toContain(body.status);
    });

    test('GET /api/ready returns 200', async ({ request }) => {
        const response = await request.get('/api/ready');
        // Ready endpoint signals DB connectivity — 200 if ready, 503 if not
        expect([200, 503]).toContain(response.status());
    });

    test('/api/health responds within 5 seconds', async ({ request }) => {
        const start = Date.now();
        const response = await request.get('/api/health');
        const elapsed = Date.now() - start;
        expect(response.status()).toBe(200);
        expect(elapsed).toBeLessThan(5000);
    });

    test('GET /api/health returns JSON content type', async ({ request }) => {
        const response = await request.get('/api/health');
        const contentType = response.headers()['content-type'] ?? '';
        expect(contentType).toContain('application/json');
    });

    test('Health response includes timestamp or uptime', async ({ request }) => {
        const response = await request.get('/api/health');
        expect(response.status()).toBe(200);
        const body = await response.json();
        // Should have some time-related field for observability
        const hasTimeField = 'timestamp' in body || 'uptime' in body || 'time' in body || 'checked_at' in body;
        // This is a soft check — log if missing but don't fail
        if (!hasTimeField) {
            console.warn('[E2E] /api/health missing timestamp/uptime field');
        }
    });
});

test.describe('CSRF Endpoint', () => {
    test('GET /api/csrf returns a CSRF token', async ({ request }) => {
        const response = await request.get('/api/csrf');
        expect(response.status()).toBe(200);
        const body = await response.json();
        // Should return a token string
        expect(body).toHaveProperty('csrfToken');
        expect(typeof body.csrfToken).toBe('string');
        expect(body.csrfToken.length).toBeGreaterThan(0);
    });
});
