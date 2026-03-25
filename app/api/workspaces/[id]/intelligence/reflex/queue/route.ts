import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
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
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const workspaceId = params.id;
    const { itemId, action } = queueActionSchema.parse(await request.json());

    const updatedItem = action === 'approve'
        ? await approveAction(workspaceId, itemId)
        : await rejectAction(workspaceId, itemId);

    return apiSuccess({ item: updatedItem });
});
