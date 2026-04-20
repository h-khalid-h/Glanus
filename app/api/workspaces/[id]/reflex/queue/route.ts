import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { getActionQueue } from '@/lib/reflex/automation';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';

interface RouteContext {
    params: Promise<{ id: string }>;
}

// GET /api/workspaces/[id]/reflex/queue - List historical and pending actions
export const GET = withErrorHandler(async (request: NextRequest, context: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    await requireWorkspaceRole(workspaceId, user.id, 'MEMBER', request);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const result = await getActionQueue(workspaceId, page, limit);
    return apiSuccess(result);
});
