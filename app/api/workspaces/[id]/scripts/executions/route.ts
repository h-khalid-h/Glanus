import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { ScriptService } from '@/lib/services/ScriptService';
import { withRateLimit } from '@/lib/security/rateLimit';

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
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50') || 50, 200);
    const status = url.searchParams.get('status');
    const scriptId = url.searchParams.get('scriptId');
    const agentId = url.searchParams.get('agentId');

    const result = await ScriptService.getScriptExecutions(params.id, {
        limit,
        status,
        scriptId,
        agentId
    });

    return apiSuccess(result);
});
