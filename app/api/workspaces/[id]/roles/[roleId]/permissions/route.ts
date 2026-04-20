import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceRoleService } from '@/lib/services/WorkspaceRoleService';
import { z } from 'zod';

const setPermissionsSchema = z.object({
    permissionIds: z.array(z.string().min(1)).min(0),
});

/**
 * PUT /api/workspaces/[id]/roles/[roleId]/permissions
 * Replace the full permission set for a workspace custom role.
 * Requires OWNER role.
 */
export const PUT = withErrorHandler(
    async (
        request: NextRequest,
        { params }: { params: Promise<{ id: string; roleId: string }> },
    ) => {
        const rateLimited = await withRateLimit(request, 'strict-api');
        if (rateLimited) return rateLimited;

        const user = await requireAuth();
        const { id: workspaceId, roleId } = await params;
        await requireWorkspaceRole(workspaceId, user.id, 'OWNER');

        const body = await request.json();
        const { permissionIds } = setPermissionsSchema.parse(body);

        const role = await WorkspaceRoleService.updateRole(workspaceId, roleId, {
            permissionIds,
        });
        return apiSuccess({ role });
    },
);
