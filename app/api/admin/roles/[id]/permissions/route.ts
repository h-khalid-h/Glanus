import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { PermissionService } from '@/lib/services/PermissionService';
import { z } from 'zod';

const setPermissionsSchema = z.object({
    permissionIds: z.array(z.string().min(1)).min(0),
});

/**
 * GET /api/admin/roles/[id]/permissions
 * Returns the permissions assigned to this platform role.
 */
export const GET = withErrorHandler(
    async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
        const rateLimited = await withRateLimit(request, 'api');
        if (rateLimited) return rateLimited;

        await requireStaff();
        const { id } = await params;

        const role = await PermissionService.getRoleWithPermissions(id);
        return apiSuccess({ permissions: role.permissions });
    },
);

/**
 * PUT /api/admin/roles/[id]/permissions
 * Replace the full permission set for a platform role.
 * Accepts { permissionIds: string[] }.
 */
export const PUT = withErrorHandler(
    async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
        const rateLimited = await withRateLimit(request, 'strict-api');
        if (rateLimited) return rateLimited;

        await requireStaff();
        const { id } = await params;

        const body = await request.json();
        const { permissionIds } = setPermissionsSchema.parse(body);

        const role = await PermissionService.setRolePermissions(id, permissionIds);
        return apiSuccess({ role });
    },
);
