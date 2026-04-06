import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, requireWorkspaceRole, runWithWorkspaceRLS } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { DashboardService } from '@/lib/services/DashboardService';

export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) return apiError(400, 'Workspace ID is required');

    await requireWorkspaceRole(workspaceId, user.id, 'VIEWER');
    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const result = await DashboardService.getDashboard(workspaceId);
        return apiSuccess(result, undefined, 200, {
            'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
        });
    });
});
