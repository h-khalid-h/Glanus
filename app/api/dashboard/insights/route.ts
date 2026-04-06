import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { DashboardService } from '@/lib/services/DashboardService';

/**
 * GET /api/dashboard/insights
 *
 * Aggregates AI insights across all workspaces the user has access to.
 * Returns recent insights, severity breakdown, and trend data.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const result = await DashboardService.getCrossWorkspaceInsights(user.id);
    return apiSuccess(result, undefined, 200, {
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
    });
});
