import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { approveAction, rejectAction } from '@/lib/reflex/automation';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';

interface RouteContext {
    params: Promise<{ id: string; itemId: string }>;
}

// PATCH /api/workspaces/[id]/reflex/queue/[itemId] - Approve or Reject an Action
export const PATCH = withErrorHandler(async (request: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId, itemId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', request);

    try {
        const body = await request.json();
        const action = body.action; // 'approve' or 'reject'

        if (action === 'approve') {
            const result = await approveAction(workspaceId, itemId);
            return apiSuccess(result, { message: 'Action approved and execution queued' }, 200);
        } else if (action === 'reject') {
            const result = await rejectAction(workspaceId, itemId);
            return apiSuccess(result, { message: 'Action rejected' }, 200);
        } else {
            return apiError(400, 'Invalid action specified. Must be "approve" or "reject"');
        }
    } catch (error: unknown) {
        return apiError(500, 'Failed to process Reflex action', (error as Error).message);
    }
});
