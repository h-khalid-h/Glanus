import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { notificationOrchestrator } from '@/lib/services/NotificationOrchestratorService';
import { logInfo, logError } from '@/lib/logger';
import crypto from 'crypto';
import { AlertService } from '@/lib/services/AlertService';
import { WorkspaceAuditService } from '@/lib/services/WorkspaceAuditService';

/**
 * Background job endpoint to process alerts.
 *
 * Security: Protected by timing-safe CRON_SECRET check on every request.
 */

function verifyCronSecret(request: NextRequest): boolean {
    const cronSecret = request.headers.get('Authorization');
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || !cronSecret) return false;
    const expected = `Bearer ${expectedSecret}`;
    return (
        cronSecret.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expected))
    );
}

// POST /api/cron/process-alerts — Run alert processing cycle
export async function POST(request: NextRequest) {
    try {
        if (!verifyCronSecret(request)) return apiError(401, 'Unauthorized');

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
    } catch (error: unknown) {
        logError('[CRON] Alert processing error', error);
        return apiError(500, error instanceof Error ? error.message : 'Unknown error');
    }
}

// GET /api/cron/process-alerts — Status/health check
export async function GET(request: NextRequest) {
    try {
        if (!verifyCronSecret(request)) return apiError(401, 'Unauthorized');

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
    } catch (error: unknown) {
        return apiError(500, error instanceof Error ? error.message : 'Unknown error');
    }
}
