import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { forecastFailures, getCapacityIntelligence, getSLOStatus } from '@/lib/oracle/predictions';
import { withRateLimit } from '@/lib/security/rateLimit';

/**
 * GET /api/workspaces/[id]/intelligence/oracle?type=failures|capacity|slo
 *
 * Predictive intelligence — failure forecasting, capacity projections, SLO burn rates.
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const workspaceId = params.id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'failures';

    switch (type) {
        case 'failures': {
            const forecasts = await forecastFailures(workspaceId);
            return apiSuccess({
                type: 'failures',
                forecasts,
                summary: {
                    total: forecasts.length,
                    critical: forecasts.filter(f => f.severity === 'critical').length,
                    high: forecasts.filter(f => f.severity === 'high').length,
                },
            });
        }

        case 'capacity': {
            const capacity = await getCapacityIntelligence(workspaceId);
            return apiSuccess({
                type: 'capacity',
                ...capacity,
            });
        }

        case 'slo': {
            const sloStatus = await getSLOStatus(workspaceId);
            return apiSuccess({
                type: 'slo',
                slos: sloStatus,
                summary: {
                    total: sloStatus.length,
                    met: sloStatus.filter(s => s.status === 'met').length,
                    atRisk: sloStatus.filter(s => s.status === 'at_risk').length,
                    breached: sloStatus.filter(s => s.status === 'breached').length,
                },
            });
        }

        default:
            return apiError(400, `Unknown prediction type: ${type}. Use: failures, capacity, slo`);
    }
});
