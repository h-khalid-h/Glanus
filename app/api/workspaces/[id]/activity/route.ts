import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceService } from '@/lib/services/WorkspaceService';

// GET /api/workspaces/[id]/activity
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const url = new URL(request.url);
    const result = await WorkspaceService.getActivity(workspaceId, {
        limit: Math.min(parseInt(url.searchParams.get('limit') || '50') || 50, 200),
        cursor: url.searchParams.get('cursor') || undefined,
        types: url.searchParams.get('types'),
    });

    return apiSuccess(result);
});
