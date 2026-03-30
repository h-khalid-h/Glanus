import { apiDeleted } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { deleteRule } from '@/lib/reflex/automation';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';

interface RouteContext {
    params: Promise<{ id: string; ruleId: string }>;
}

// DELETE /api/workspaces/[id]/reflex/rules/[ruleId] - Remove a reflexive rule
export const DELETE = withErrorHandler(async (request: NextRequest, context: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const user = await requireAuth();
    const { id: workspaceId, ruleId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', request);
    await deleteRule(workspaceId, ruleId);
    return apiDeleted();
});
