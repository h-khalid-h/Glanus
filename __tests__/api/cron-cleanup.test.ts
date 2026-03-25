/**
 * @jest-environment node
 */
/**
 * Cleanup Cron Route — Unit Tests
 */

// Mock prisma
const mockDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
jest.mock('@/lib/db', () => ({
    prisma: {
        agentMetric: { deleteMany: (...args: any[]) => mockDeleteMany(...args) },
        auditLog: { deleteMany: (...args: any[]) => mockDeleteMany(...args) },
        aIInsight: { deleteMany: (...args: any[]) => mockDeleteMany(...args) },
        remoteSession: { deleteMany: (...args: any[]) => mockDeleteMany(...args) },
    },
}));

jest.mock('@/lib/logger', () => ({
    logInfo: jest.fn(),
    logError: jest.fn(),
}));

import { POST } from '@/app/api/cron/cleanup/route';
import { NextRequest } from 'next/server';

function makeRequest(secret?: string): NextRequest {
    const headers: Record<string, string> = {};
    if (secret) headers['authorization'] = `Bearer ${secret}`;
    return new NextRequest('http://localhost:3000/api/cron/cleanup', {
        method: 'POST',
        headers,
    });
}

describe('POST /api/cron/cleanup', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...OLD_ENV, CRON_SECRET: 'test-cron-secret' };
        mockDeleteMany.mockResolvedValue({ count: 5 });
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    it('rejects requests without auth header', async () => {
        const res = await POST(makeRequest());
        expect(res.status).toBe(401);
    });

    it('rejects requests with wrong secret', async () => {
        const res = await POST(makeRequest('wrong-secret'));
        expect(res.status).toBe(401);
    });

    it('rejects when CRON_SECRET is not set', async () => {
        delete process.env.CRON_SECRET;
        const res = await POST(makeRequest('any-secret'));
        expect(res.status).toBe(401);
    });

    it('succeeds with correct secret and returns counts', async () => {
        const res = await POST(makeRequest('test-cron-secret'));
        expect(res.status).toBe(200);

        const body = await res.json();
        // apiSuccess wraps in { data: ... } or returns flat — check both
        const payload = body.data || body;
        expect(payload.metricsDeleted).toBe(5);
        expect(payload.auditLogsDeleted).toBe(5);
        expect(payload.alertsDeleted).toBe(5);
        expect(payload.cutoffs).toBeDefined();
        expect(payload.cutoffs.metrics).toBeDefined();
        expect(payload.cutoffs.auditLogs).toBeDefined();
        expect(payload.cutoffs.alerts).toBeDefined();
    });

    it('calls deleteMany with correct date cutoffs', async () => {
        const before = Date.now();
        await POST(makeRequest('test-cron-secret'));
        const after = Date.now();

        // 4 deleteMany calls (metrics, audit, alerts, remote sessions)
        expect(mockDeleteMany).toHaveBeenCalledTimes(4);

        // Verify 90-day cutoff for metrics
        const metricsArg = mockDeleteMany.mock.calls[0][0];
        const metricsCutoff = metricsArg.where.timestamp.lt.getTime();
        const expected90d = before - 90 * 24 * 60 * 60 * 1000;
        expect(metricsCutoff).toBeGreaterThanOrEqual(expected90d - 1000);
        expect(metricsCutoff).toBeLessThanOrEqual(after);
    });

    it('returns 500 on database error', async () => {
        mockDeleteMany.mockRejectedValueOnce(new Error('DB connection lost'));
        const res = await POST(makeRequest('test-cron-secret'));
        expect(res.status).toBe(500);
    });
});
