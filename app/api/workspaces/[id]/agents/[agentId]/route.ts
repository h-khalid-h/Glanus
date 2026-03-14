import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { WorkspaceSubFeatureService } from '@/lib/services/WorkspaceSubFeatureService';

type RouteContext = { params: Promise<{ id: string; agentId: string }> };

/**
 * GET /api/workspaces/[id]/agents/[agentId]
 * Fetch detailed agent information including:
 *   - Agent system info & current metrics
 *   - Last 24h of metric history from AgentMetric table
 *   - Recent script executions dispatched to this agent
 */
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId, agentId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'MEMBER');
    const result = await WorkspaceSubFeatureService.getWorkspaceAgent(workspaceId, agentId);
    return apiSuccess(result);
});
