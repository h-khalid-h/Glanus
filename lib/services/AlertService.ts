import { prisma } from '@/lib/db';
import { logInfo, logError } from '@/lib/logger';
import { forecastFailures } from '@/lib/oracle/predictions';

export class AlertService {
    /**
     * Executes the Oracle prediction logic against all workspaces to generate proactive AI Insights.
     * Extracts complex DB anomaly detection from the cron HTTP route.
     */
    static async evaluateOracleMatrix() {
        logInfo('[SERVICE] Orchestrating Oracle Predictions Matrix...');

        let insightsGenerated = 0;
        let aiErrors = 0;

        // Fetch all workspaces natively to ensure Oracle evaluates environments regardless of manual alert rules
        const allWorkspaces = await prisma.workspace.findMany({ where: { deletedAt: null }, select: { id: true }, take: 1000 });

        for (const workspace of allWorkspaces) {
            try {
                // Execute Oracle prediction logic
                const forecasts = await forecastFailures(workspace.id);
                const criticalForecasts = forecasts.filter(f => f.severity === 'critical' || f.severity === 'high');

                if (!criticalForecasts.length) continue;

                // ── Batch dedup: 1 SELECT per workspace instead of N SELECTs ─────────
                const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
                const recentInsights = await prisma.aIInsight.findMany({
                    where: {
                        workspaceId: workspace.id,
                        type: 'CAPACITY_FORECAST',
                        createdAt: { gte: sixHoursAgo },
                    },
                    select: { assetId: true },
                });
                const recentAssetIds = new Set(recentInsights.map((i) => i.assetId));

                // Only create insights for forecasts not already throttled
                const newForecasts = criticalForecasts.filter((f) => !recentAssetIds.has(f.assetId));

                if (newForecasts.length) {
                    // Map oracle severity levels to valid Prisma enum values
                    const severityMap: Record<string, 'INFO' | 'WARNING' | 'CRITICAL'> = {
                        low: 'INFO',
                        medium: 'WARNING',
                        high: 'WARNING',
                        critical: 'CRITICAL',
                    };
                    await prisma.aIInsight.createMany({
                        data: newForecasts.map((forecast) => ({
                            workspaceId: workspace.id,
                            assetId: forecast.assetId,
                            type: 'CAPACITY_FORECAST' as const,
                            severity: severityMap[forecast.severity] || 'WARNING',
                            title: `Capacity Burn - ${forecast.metric.toUpperCase()}`,
                            description: `Oracle expects ${forecast.metric.toUpperCase()} exhaustion in ${forecast.timeToThreshold}.`,
                            confidence: forecast.confidence,
                            metadata: {
                                recommendations: [
                                    `Review ${forecast.metric} resource consumption immediately.`,
                                    `Consider upgrading allocations before failure state occurs.`,
                                ],
                            },
                        })),
                        skipDuplicates: true,
                    });
                    insightsGenerated += newForecasts.length;
                }
            } catch (insightErr) {
                logError(`[SERVICE] Failed persisting insights for workspace ${workspace.id}`, insightErr);
                aiErrors++;
            }
        }

        return {
            insightsGenerated,
            aiErrors
        };
    }
}
