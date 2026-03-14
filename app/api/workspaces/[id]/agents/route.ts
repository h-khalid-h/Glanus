import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { WorkspaceSubFeatureService } from '@/lib/services/WorkspaceSubFeatureService';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workspaces/[id]/agents - List workspace agents
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);
    const result = await WorkspaceSubFeatureService.listWorkspaceAgents(workspaceId);
    return apiSuccess(result);
});
