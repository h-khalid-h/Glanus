import { prisma } from '@/lib/db';
import { logInfo, logError } from '@/lib/logger';

export class SystemMaintenanceService {
    /**
     * Scheduled job to clean up stale data:
     * - Agent metrics older than 90 days
     * - Audit logs older than 365 days
     * - Resolved alerts older than 90 days
     * - Ended/failed remote sessions older than 7 days
     * - Wedged ACTIVE remote sessions with no recent signaling activity
     *   (auto-marked FAILED so the per-asset lock releases)
     */
    static async executeDataCleanup() {
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        // A live remote session has signaling activity (ICE candidate
        // append, status PATCH, etc.) at least every few seconds during
        // setup and on every heartbeat afterwards — `updatedAt` bumps via
        // `@updatedAt`. A session that has not been touched for STALE_AGE
        // is almost certainly orphaned (agent crash, host network gone,
        // tab closed without DELETE). Marking it FAILED here releases
        // the per-asset lock in RemoteSessionService.createSession so
        // the next legitimate request from the same asset succeeds
        // immediately instead of hitting a 409 conflict.
        const STALE_ACTIVE_AGE_MS = 5 * 60 * 1000; // 5 minutes
        const staleActiveCutoff = new Date(now.getTime() - STALE_ACTIVE_AGE_MS);

        const results = {
            metricsDeleted: 0,
            auditLogsDeleted: 0,
            alertsDeleted: 0,
            remoteSessionsDeleted: 0,
            staleSessionsReaped: 0,
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

            // 4. Clean up ended/failed remote sessions older than 7 days
            const sessionsResult = await prisma.remoteSession.deleteMany({
                where: {
                    status: { in: ['ENDED', 'FAILED'] },
                    endedAt: { lt: sevenDaysAgo },
                },
            });
            results.remoteSessionsDeleted = sessionsResult.count;

            // 5. Reap wedged ACTIVE remote sessions with no recent
            //    signaling activity. We mark them FAILED (rather than
            //    deleting) so the audit trail and metrics survive, and
            //    we set endedAt for accurate duration accounting and so
            //    the 7-day delete pass above will reclaim them later.
            const reapResult = await prisma.remoteSession.updateMany({
                where: {
                    status: 'ACTIVE',
                    updatedAt: { lt: staleActiveCutoff },
                },
                data: {
                    status: 'FAILED',
                    endedAt: now,
                },
            });
            results.staleSessionsReaped = reapResult.count;
            if (reapResult.count > 0) {
                logInfo('[SERVICE] Reaped stale ACTIVE remote sessions', {
                    count: reapResult.count,
                    cutoff: staleActiveCutoff.toISOString(),
                });
            }

            logInfo('[SERVICE] Data cleanup completed', results);

            return {
                message: 'Data cleanup completed',
                ...results,
                cutoffs: {
                    metrics: ninetyDaysAgo.toISOString(),
                    auditLogs: oneYearAgo.toISOString(),
                    alerts: ninetyDaysAgo.toISOString(),
                },
            };
        } catch (error: unknown) {
            logError('[SERVICE] Data cleanup failed', error);
            throw error;
        }
    }
}
