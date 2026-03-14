import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { deleteRule } from '@/lib/reflex/automation';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';

interface RouteContext {
    params: Promise<{ id: string; ruleId: string }>;
}

// DELETE /api/workspaces/[id]/reflex/rules/[ruleId] - Remove a reflexive rule
export const DELETE = withErrorHandler(async (request: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId, ruleId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', request);
    await deleteRule(workspaceId, ruleId);
    return apiSuccess({ deletedId: ruleId }, { message: 'Automation rule deleted successfully' }, 200);
});
