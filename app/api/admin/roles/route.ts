import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { SuperAdminRoleService } from '@/lib/services/SuperAdminRoleService';
import { z } from 'zod';

/**
 * GET /api/admin/roles
 * Returns all platform roles, used to populate role selects in the UI.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    await SuperAdminRoleService.ensureDefaultRoles();
    const roles = await SuperAdminRoleService.listRoles();
    return apiSuccess({ roles });
});

const createSchema = z.object({
    name:        z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Name must be uppercase letters, digits, or underscores'),
    label:       z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    isStaff:     z.boolean().optional(),
    color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color').optional(),
});

/**
 * POST /api/admin/roles
 * Create a new platform role.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    const body = await request.json();
    const data = createSchema.parse(body);

    const role = await SuperAdminRoleService.createRole(data);
    return apiSuccess({ role }, undefined, 201);
});
