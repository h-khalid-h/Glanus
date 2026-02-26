/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { logInfo, logError } from '@/lib/logger';

/**
 * POST /api/cron/cleanup
 * 
 * Scheduled job to clean up stale data:
 * - Agent metrics older than 90 days
 * - Audit logs older than 365 days
 * - Resolved alerts older than 90 days
 * 
 * Protected by CRON_SECRET bearer token.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return apiError(401, 'Unauthorized');
    }

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const results = {
        metricsDeleted: 0,
        auditLogsDeleted: 0,
        alertsDeleted: 0,
    };

    try {
        // 1. Prune agent metrics older than 90 days
        const metricsResult = await prisma.agentMetric.deleteMany({
            where: {
                timestamp: { lt: ninetyDaysAgo },
            },
        });
        results.metricsDeleted = metricsResult.count;

        // 2. Archive/delete audit logs older than 1 year
        const auditResult = await prisma.auditLog.deleteMany({
            where: {
                createdAt: { lt: oneYearAgo },
            },
        });
        results.auditLogsDeleted = auditResult.count;

        // 3. Prune resolved alerts older than 90 days
        const alertsResult = await prisma.aIInsight.deleteMany({
            where: {
                acknowledged: true,
                createdAt: { lt: ninetyDaysAgo },
            },
        });
        results.alertsDeleted = alertsResult.count;

        logInfo('[CRON] Data cleanup completed', results);

        return apiSuccess({
            message: 'Data cleanup completed',
            ...results,
            cutoffs: {
                metrics: ninetyDaysAgo.toISOString(),
                auditLogs: oneYearAgo.toISOString(),
                alerts: ninetyDaysAgo.toISOString(),
            },
        });
    } catch (error: unknown) {
        logError('[CRON] Data cleanup failed', error);
        return apiError(500, 'Cleanup failed', error instanceof Error ? error.message : 'Unknown error');
    }
});
