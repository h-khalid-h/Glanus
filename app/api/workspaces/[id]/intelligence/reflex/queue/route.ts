import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { approveAction, rejectAction } from '@/lib/reflex/automation';
import { z } from 'zod';

const queueActionSchema = z.object({
    itemId: z.string().cuid(),
    action: z.enum(['approve', 'reject']),
});

/**
 * PUT /api/workspaces/[id]/intelligence/reflex/queue
 * Body: { itemId: string, action: 'approve' | 'reject' }
 *
 * Approves or rejects a pending reflex action.
 */
export const PUT = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const workspaceId = params.id;
    const body = await request.json();
    const parsed = queueActionSchema.safeParse(body);

    if (!parsed.success) {
        return apiError(400, parsed.error.errors[0].message);
    }

    const { itemId, action } = parsed.data;

    try {
        let updatedItem;
        if (action === 'approve') {
            updatedItem = await approveAction(workspaceId, itemId);
        } else {
            updatedItem = await rejectAction(workspaceId, itemId);
        }

        return apiSuccess({ item: updatedItem });
    } catch (error: unknown) {
        return apiError(404, 'Action not found or not in pending state');
    }
});
