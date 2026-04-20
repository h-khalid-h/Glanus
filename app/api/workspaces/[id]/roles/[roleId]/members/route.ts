import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceRoleService } from '@/lib/services/WorkspaceRoleService';
import { z } from 'zod';

const memberSchema = z.object({
    userId: z.string().min(1),
});

/**
 * POST /api/workspaces/[id]/roles/[roleId]/members
 * Assign a user to a custom workspace role.
 * Requires ADMIN role minimum.
 */
export const POST = withErrorHandler(
    async (
        request: NextRequest,
        { params }: { params: Promise<{ id: string; roleId: string }> },
    ) => {
        const rateLimited = await withRateLimit(request, 'strict-api');
        if (rateLimited) return rateLimited;

        const user = await requireAuth();
        const { id: workspaceId, roleId } = await params;
        await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

        const body = await request.json();
        const { userId } = memberSchema.parse(body);

        await WorkspaceRoleService.assignMember(roleId, userId);
        return apiSuccess({ message: 'Member assigned to role' }, undefined, 201);
    },
);

/**
 * DELETE /api/workspaces/[id]/roles/[roleId]/members
 * Remove a user from a custom workspace role.
 * Requires ADMIN role minimum.
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
        await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

        const body = await request.json();
        const { userId } = memberSchema.parse(body);

        await WorkspaceRoleService.removeMember(roleId, userId);
        return new Response(null, { status: 204 });
    },
);
