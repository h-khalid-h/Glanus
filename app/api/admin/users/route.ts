import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { SuperAdminUserService } from '@/lib/services/SuperAdminUserService';
import { SuperAdminRoleService } from '@/lib/services/SuperAdminRoleService';
import { z } from 'zod';
import type { UserRole } from '@prisma/client';

const VALID_ROLES = new Set<string>(['USER', 'IT_STAFF', 'ADMIN', 'STAFF']);

/**
 * GET /api/admin/users?page=1&limit=20&search=&role=
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const search = (searchParams.get('search') ?? '').trim();
    const role   = searchParams.get('role') ?? '';
    const isStaffParam = searchParams.get('isStaff');

    // Default to staff-only unless explicitly overridden
    const isStaff = isStaffParam === null ? true : isStaffParam === 'true';

    const roleFilter = VALID_ROLES.has(role.toUpperCase())
        ? (role.toUpperCase() as UserRole | 'STAFF')
        : undefined;

    const result = await SuperAdminUserService.listUsers(page, limit, search, roleFilter, isStaff);

    return apiSuccess({
        users: result.users,
        meta: {
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        },
    });
});

const createUserSchema = z.object({
    email:          z.string().email(),
    name:           z.string().min(1).max(200),
    password:       z.string().min(8).max(128),
    platformRoleId: z.string().min(1),
    isStaff:        z.boolean().optional(),
    emailVerified:  z.boolean().optional(),
});

/**
 * POST /api/admin/users
 * Create a new platform user.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    const body = await request.json();
    const parsed = createUserSchema.parse(body);

    // Resolve the UserRole enum from the PlatformRole
    const roles = await SuperAdminRoleService.listRoles();
    const pr = roles.find((r) => r.id === parsed.platformRoleId);
    const enumRole: UserRole = (['ADMIN', 'IT_STAFF', 'USER'] as UserRole[]).includes(pr?.name as UserRole)
        ? (pr!.name as UserRole)
        : 'USER';

    const user = await SuperAdminUserService.createUser({
        email: parsed.email,
        name: parsed.name,
        password: parsed.password,
        role: enumRole,
        platformRoleId: parsed.platformRoleId,
        isStaff: true, // Staff users created from super-admin always get staff access
        emailVerified: parsed.emailVerified,
    });

    return apiSuccess({ user }, undefined, 201);
});
