import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { notificationOrchestrator } from '@/lib/notification-orchestrator';
import { logInfo, logError } from '@/lib/logger';

/**
 * Background job endpoint to process alerts
 * 
 * This should be called:
 * 1. Via cron job (every 5 minutes) for regular alert checks
 * 2. Via manual trigger for testing
 * 
 * Security: In production, this should be protected by:
 * - Secret token in Authorization header
 * - IP whitelist (only allow from cron service)
 * - Rate limiting
 */
export async function POST(request: NextRequest) {
    try {
        // Security check: verify cron secret (ALWAYS required)
        const cronSecret = request.headers.get('Authorization');
        const expectedSecret = process.env.CRON_SECRET;

        if (!expectedSecret || cronSecret !== `Bearer ${expectedSecret}`) {
            return apiError(401, 'Unauthorized');
        }

        logInfo('[CRON] Starting alert processing...');
        const startTime = Date.now();

        // Process all workspaces
        const results = await notificationOrchestrator.processAll();

        const duration = Date.now() - startTime;

        // Aggregate stats
        const stats = {
            workspaces: results.length,
            alertsTriggered: results.reduce((sum, r) => sum + r.alertsTriggered, 0),
            emailsSent: results.reduce((sum, r) => sum + r.emailsSent, 0),
            webhooksSent: results.reduce((sum, r) => sum + r.webhooksSent, 0),
            errors: results.reduce((sum, r) => sum + r.errors.length, 0),
            duration,
        };

        logInfo('[CRON] Alert processing complete', stats);

        // Return detailed results
        return apiSuccess({
            success: true,
            stats,
            results,
            timestamp: new Date().toISOString(),
        });
    } catch (error: unknown) {
        logError('[CRON] Alert processing error', error);
        return apiSuccess({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        }, undefined, 500);
    }
}

// GET - Get cron job status/info (for debugging)
export async function GET(request: NextRequest) {
    try {
        // Security: require CRON_SECRET for status endpoint too
        const cronSecret = request.headers.get('Authorization');
        const expectedSecret = process.env.CRON_SECRET;

        if (!expectedSecret || cronSecret !== `Bearer ${expectedSecret}`) {
            return apiError(401, 'Unauthorized');
        }

        const { prisma } = await import('@/lib/db');

        // Get stats about alert system
        const [
            totalRules,
            enabledRules,
            workspacesWithAlerts,
            totalWebhooks,
        ] = await Promise.all([
            prisma.alertRule.count(),
            prisma.alertRule.count({ where: { enabled: true } }),
            prisma.workspace.count({
                where: {
                    alertRules: {
                        some: {
                            enabled: true,
                        },
                    },
                },
            }),
            prisma.notificationWebhook.count({ where: { enabled: true } }),
        ]);

        return apiSuccess({
            status: 'ready',
            alertSystem: {
                totalRules,
                enabledRules,
                workspacesWithAlerts,
                totalWebhooks,
            },
            cronInfo: {
                endpoint: '/api/cron/process-alerts',
                method: 'POST',
                recommendedInterval: '*/5 * * * *', // Every 5 minutes
                requiresAuth: !!process.env.CRON_SECRET,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error: unknown) {
        return apiSuccess({ error: error instanceof Error ? error.message : 'Unknown error' }, undefined, 500);
    }
}
