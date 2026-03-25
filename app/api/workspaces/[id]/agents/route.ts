import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceAgentService } from '@/lib/services/WorkspaceAgentService';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workspaces/[id]/agents - List workspace agents (paginated)
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 200);

    const result = await WorkspaceAgentService.listWorkspaceAgents(workspaceId, page, limit);
    return apiSuccess(result);
});
