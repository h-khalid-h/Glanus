import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceRoleService } from '@/lib/services/WorkspaceRoleService';
import { z } from 'zod';

const updateSchema = z.object({
    label: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    permissionIds: z.array(z.string().min(1)).optional(),
});

/**
 * GET /api/workspaces/[id]/roles/[roleId]
 * Get a single custom role with its permissions.
 */
export const GET = withErrorHandler(
    async (
        request: NextRequest,
        { params }: { params: Promise<{ id: string; roleId: string }> },
    ) => {
        const rateLimited = await withRateLimit(request, 'api');
        if (rateLimited) return rateLimited;

        const user = await requireAuth();
        const { id: workspaceId, roleId } = await params;
        await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

        const role = await WorkspaceRoleService.getRole(workspaceId, roleId);
        return apiSuccess({ role });
    },
);

/**
 * PUT /api/workspaces/[id]/roles/[roleId]
 * Update a custom workspace role.
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
        const data = updateSchema.parse(body);

        const role = await WorkspaceRoleService.updateRole(workspaceId, roleId, data);
        return apiSuccess({ role });
    },
);

/**
 * DELETE /api/workspaces/[id]/roles/[roleId]
 * Delete a custom workspace role (cannot delete built-in roles).
 * Requires OWNER role.
 */
export const DELETE = withErrorHandler(
    async (
        request: NextRequest,
        { params }: { params: Promise<{ id: string; roleId: string }> },
    ) => {
        const rateLimited = await withRateLimit(request, 'strict-api');
        if (rateLimited) return rateLimited;

        const user = await requireAuth();
        const { id: workspaceId, roleId } = await params;
        await requireWorkspaceRole(workspaceId, user.id, 'OWNER');

        await WorkspaceRoleService.deleteRole(workspaceId, roleId);
        return new Response(null, { status: 204 });
    },
);
