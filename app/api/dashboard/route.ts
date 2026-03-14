import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, requireWorkspaceRole } from '@/lib/api/withAuth';
import { DashboardService } from '@/lib/services/DashboardService';

export const GET = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) return apiError(400, 'Workspace ID is required');

    await requireWorkspaceRole(workspaceId, user.id, 'VIEWER');

    const result = await DashboardService.getDashboard(workspaceId);
    return apiSuccess(result);
});
