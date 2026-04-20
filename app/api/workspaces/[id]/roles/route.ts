import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceRoleService } from '@/lib/services/WorkspaceRoleService';
import { PermissionService } from '@/lib/services/PermissionService';
import { z } from 'zod';

/**
 * GET /api/workspaces/[id]/roles
 * List all custom roles for a workspace.
 * Requires ADMIN role minimum.
 */
export const GET = withErrorHandler(
    async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
        const rateLimited = await withRateLimit(request, 'api');
        if (rateLimited) return rateLimited;

        const user = await requireAuth();
        const { id: workspaceId } = await params;
        await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

        // Ensure default roles are seeded
        await PermissionService.seedPermissions();
        await WorkspaceRoleService.seedDefaultRoles(workspaceId);

        const roles = await WorkspaceRoleService.listRoles(workspaceId);

        // Also return available workspace permissions for the matrix
        const availablePermissions = await PermissionService.listPermissions('WORKSPACE');

        return apiSuccess({ roles, availablePermissions });
    },
);

const createSchema = z.object({
    name: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Name must be uppercase letters, digits, or underscores'),
    label: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    permissionIds: z.array(z.string().min(1)).optional(),
});

/**
 * POST /api/workspaces/[id]/roles
 * Create a new custom role within a workspace.
 * Requires OWNER role.
 */
export const POST = withErrorHandler(
    async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
        const rateLimited = await withRateLimit(request, 'strict-api');
        if (rateLimited) return rateLimited;

        const user = await requireAuth();
        const { id: workspaceId } = await params;
        await requireWorkspaceRole(workspaceId, user.id, 'OWNER');

        const body = await request.json();
        const data = createSchema.parse({
            ...body,
            name: typeof body.name === 'string' ? body.name.toUpperCase().replace(/\s+/g, '_') : body.name,
        });

        const role = await WorkspaceRoleService.createRole(workspaceId, data);
        return apiSuccess({ role }, undefined, 201);
    },
);
