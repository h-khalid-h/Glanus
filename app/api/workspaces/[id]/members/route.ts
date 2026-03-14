import { apiSuccess } from '@/lib/api/response';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { WorkspaceMemberService } from '@/lib/services/WorkspaceMemberService';

// GET /api/workspaces/[id]/members
export const GET = withErrorHandler(async (
    _request: Request,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const members = await WorkspaceMemberService.listMembers(workspaceId);
    return apiSuccess({ members });
});
