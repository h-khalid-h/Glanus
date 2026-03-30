import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { approveAction, rejectAction } from '@/lib/reflex/automation';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { z } from 'zod';

interface RouteContext {
    params: Promise<{ id: string; itemId: string }>;
}

const ReflexQueueActionSchema = z.object({
    action: z.enum(['approve', 'reject'], {
        errorMap: () => ({ message: 'Invalid action. Must be "approve" or "reject"' }),
    }),
});

// PATCH /api/workspaces/[id]/reflex/queue/[itemId] - Approve or Reject an Action
export const PATCH = withErrorHandler(async (request: NextRequest, context: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const user = await requireAuth();
    const { id: workspaceId, itemId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN', request);

    const body = await request.json();
    const { action } = ReflexQueueActionSchema.parse(body);

    if (action === 'approve') {
        const result = await approveAction(workspaceId, itemId);
        return apiSuccess(result, { message: 'Action approved and execution queued' }, 200);
    } else {
        const result = await rejectAction(workspaceId, itemId);
        return apiSuccess(result, { message: 'Action rejected' }, 200);
    }
});
