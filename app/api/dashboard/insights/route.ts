import { apiSuccess } from '@/lib/api/response';
import { withErrorHandler, requireAuth } from '@/lib/api/withAuth';
import { DashboardService } from '@/lib/services/DashboardService';

/**
 * GET /api/dashboard/insights
 *
 * Aggregates AI insights across all workspaces the user has access to.
 * Returns recent insights, severity breakdown, and trend data.
 */
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    const result = await DashboardService.getCrossWorkspaceInsights(user.id);
    return apiSuccess(result);
});
