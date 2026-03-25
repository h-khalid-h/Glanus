import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { forecastFailures, getCapacityIntelligence, getSLOStatus } from '@/lib/oracle/predictions';

// GET /api/workspaces/[id]/oracle - Get oracle predictions & forecasts
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    // Run all prediction modules in parallel
    const [failures, capacity, slos] = await Promise.all([
        forecastFailures(workspaceId).catch(() => []),
        getCapacityIntelligence(workspaceId).catch(() => ({
            workspaceId,
            resources: [],
            recommendations: [],
        })),
        getSLOStatus(workspaceId).catch(() => []),
    ]);

    // Compute urgency summary
    const criticalForecasts = failures.filter(f => f.severity === 'critical' || f.severity === 'high');
    const criticalResources = capacity.resources.filter(r => r.status === 'critical' || r.status === 'warning');
    const sloAtRisk = slos.filter(s => s.status === 'at_risk' || s.status === 'breached');

    return apiSuccess({
        failures,
        capacity,
        slos,
        summary: {
            totalForecasts: failures.length,
            criticalForecasts: criticalForecasts.length,
            criticalResources: criticalResources.length,
            sloAtRisk: sloAtRisk.length,
            overallStatus: criticalForecasts.length > 0 ? 'attention'
                : criticalResources.length > 0 ? 'watch'
                    : 'nominal',
        },
    });
});
