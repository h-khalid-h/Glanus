import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ScriptService } from '@/lib/services/ScriptService';
import { withRateLimit } from '@/lib/security/rateLimit';

/**
 * POST /api/workspaces/[id]/scripts/executions/[executionId]/cancel
 * Force-terminate a PENDING or RUNNING script execution. Used when an agent
 * never reports back (e.g. crashed mid-run) so the UI is not left with rows
 * stuck in RUNNING forever. Requires ADMIN role.
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string; executionId: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId, executionId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const result = await ScriptService.cancelExecution(workspaceId, executionId, user.id);
    if (!result) return apiError(404, 'Execution not found.');

    return apiSuccess(result, { message: `Execution ${result.status === 'FAILED' ? 'cancelled' : 'already ' + result.status.toLowerCase()}.` });
});
