import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withCronHandler } from '@/lib/api/withAuth';
import { notificationOrchestrator } from '@/lib/services/NotificationOrchestratorService';
import { logInfo } from '@/lib/logger';
import { AlertService } from '@/lib/services/AlertService';
import { WorkspaceAuditService } from '@/lib/services/WorkspaceAuditService';

/**
 * Background job endpoint to process alerts.
 *
 * Security: Protected by timing-safe CRON_SECRET check on every request.
 */

// POST /api/cron/process-alerts — Run alert processing cycle
export const POST = withCronHandler(async (_request: NextRequest) => {

    logInfo('[CRON] Starting alert processing...');
    const startTime = Date.now();

    const results = await notificationOrchestrator.processAll();
    const oracleResults = await AlertService.evaluateOracleMatrix();
    const duration = Date.now() - startTime;

    const stats = {
        workspaces: results.length,
        alertsTriggered: results.reduce((sum, r) => sum + r.alertsTriggered, 0),
        emailsSent: results.reduce((sum, r) => sum + r.emailsSent, 0),
        webhooksSent: results.reduce((sum, r) => sum + r.webhooksSent, 0),
        aiInsightsGenerated: oracleResults.insightsGenerated,
        errors: results.reduce((sum, r) => sum + r.errors.length, 0) + oracleResults.aiErrors,
        duration,
    };

    logInfo('[CRON] Alert processing complete', stats);
    return apiSuccess({ success: true, stats, results, timestamp: new Date().toISOString() });
});

// GET /api/cron/process-alerts — Status/health check
export const GET = withCronHandler(async (_request: NextRequest) => {
    const alertSystem = await WorkspaceAuditService.getStats();

    return apiSuccess({
        status: 'ready',
        alertSystem,
        cronInfo: {
            endpoint: '/api/cron/process-alerts',
            method: 'POST',
            recommendedInterval: '*/5 * * * *',
            requiresAuth: !!process.env.CRON_SECRET,
        },
        timestamp: new Date().toISOString(),
    });
});
