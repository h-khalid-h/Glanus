import { prisma } from '@/lib/db';
import { logInfo, logError } from '@/lib/logger';

export class SystemMaintenanceService {
    /**
     * Scheduled job to clean up stale data:
     * - Agent metrics older than 90 days
     * - Audit logs older than 365 days
     * - Resolved alerts older than 90 days
     * - Ended/failed remote sessions older than 7 days
     */
    static async executeDataCleanup() {
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const results = {
            metricsDeleted: 0,
            auditLogsDeleted: 0,
            alertsDeleted: 0,
            remoteSessionsDeleted: 0,
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
