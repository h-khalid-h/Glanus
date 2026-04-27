import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceAgentService } from '@/lib/services/WorkspaceAgentService';

type RouteContext = { params: Promise<{ id: string; agentId: string }> };

/**
 * GET /api/workspaces/[id]/agents/[agentId]
 * Fetch detailed agent information including:
 *   - Agent system info & current metrics
 *   - Last 24h of metric history from AgentMetric table
 *   - Recent script executions dispatched to this agent
 *   - canCreateAsset flag — true when the agent is not linked to an asset yet
 */
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId, agentId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'MEMBER');
    const result = await WorkspaceAgentService.getWorkspaceAgent(workspaceId, agentId);

    // `canCreateAsset` is true when the agent exists but is not yet linked to
    // an asset — the UI uses this to show the "Create Asset" banner.
    const canCreateAsset = !result.agent.assetId;

    return apiSuccess({ ...result, canCreateAsset });
});
