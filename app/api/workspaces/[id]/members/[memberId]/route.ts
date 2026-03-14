import { apiSuccess, apiError } from '@/lib/api/response';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { z } from 'zod';
import { WorkspaceService } from '@/lib/services/WorkspaceService';

const updateRoleSchema = z.object({
    role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

// PATCH /api/workspaces/[id]/members/[memberId]
export const PATCH = withErrorHandler(async (
    request: Request,
    context: { params: Promise<{ id: string; memberId: string }> }
) => {
    const { id: workspaceId, memberId } = await context.params;
    const user = await requireAuth();
    const { workspace } = await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const body = await request.json();
    const validation = updateRoleSchema.safeParse(body);
    if (!validation.success) return apiError(400, 'Validation failed', validation.error.errors);

    try {
        const member = await WorkspaceService.updateMemberRole(
            workspaceId, memberId, user.id, validation.data.role, workspace.name,
        );
        return apiSuccess({ member });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// DELETE /api/workspaces/[id]/members/[memberId]
export const DELETE = withErrorHandler(async (
    _request: Request,
    context: { params: Promise<{ id: string; memberId: string }> }
) => {
    const { id: workspaceId, memberId } = await context.params;
    const user = await requireAuth();
    const { workspace } = await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    try {
        await WorkspaceService.removeMember(workspaceId, memberId, user.id, workspace.name);
        return apiSuccess({ message: 'Member removed' });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
