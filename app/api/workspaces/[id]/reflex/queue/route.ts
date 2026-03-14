import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { getActionQueue } from '@/lib/reflex/automation';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';

interface RouteContext {
    params: Promise<{ id: string }>;
}

// GET /api/workspaces/[id]/reflex/queue - List historical and pending actions
export const GET = withErrorHandler(async (request: NextRequest, context: RouteContext) => {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'MEMBER', request);

    try {
        const queue = await getActionQueue(workspaceId);
        return apiSuccess(queue);
    } catch (error: unknown) {
        return apiError(500, 'Failed to fetch Reflex action queue', (error as Error).message);
    }
});
