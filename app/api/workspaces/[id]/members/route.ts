import { apiSuccess } from '@/lib/api/response';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { WorkspaceService } from '@/lib/services/WorkspaceService';

// GET /api/workspaces/[id]/members
export const GET = withErrorHandler(async (
    _request: Request,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const members = await WorkspaceService.listMembers(workspaceId);
    return apiSuccess({ members });
});
