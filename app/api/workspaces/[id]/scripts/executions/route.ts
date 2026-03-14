import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ScriptService } from '@/lib/services/ScriptService';

/**
 * GET /api/workspaces/[id]/scripts/executions
 * Fetch all script execution history for a workspace.
 * 
 * Query params:
 *   - limit (default 50, max 200)
 *   - status (optional: PENDING, RUNNING, SUCCESS, FAILED)
 *   - scriptId (optional: filter by script template)
 *   - agentId (optional: filter by agent)
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const status = url.searchParams.get('status');
    const scriptId = url.searchParams.get('scriptId');
    const agentId = url.searchParams.get('agentId');

    try {
        const result = await ScriptService.getScriptExecutions(params.id, {
            limit,
            status,
            scriptId,
            agentId
        });

        return apiSuccess(result);
    } catch (_error) {
        return apiError(500, 'Failed to fetch script executions');
    }
});
