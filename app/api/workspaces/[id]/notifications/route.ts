import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { WorkspaceSubFeatureService } from '@/lib/services/WorkspaceSubFeatureService';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100')));

    const notifications = await WorkspaceSubFeatureService.getNotifications(workspaceId, limit);
    return apiSuccess({ notifications });
});
