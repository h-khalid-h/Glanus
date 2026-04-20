import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { requireStaff, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';

import { PermissionService } from '@/lib/services/PermissionService';
import { z } from 'zod';

const updateSchema = z.object({
    label: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    isStaff: z.boolean().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

/**
 * GET /api/admin/roles/[id]
 * Returns a single platform role with its assigned permissions.
 */
export const GET = withErrorHandler(
    async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
        const rateLimited = await withRateLimit(request, 'api');
        if (rateLimited) return rateLimited;

        await requireStaff();
        const { id } = await params;

        const role = await PermissionService.getRoleWithPermissions(id);
        return apiSuccess({ role });
    },
);

/**
 * PUT /api/admin/roles/[id]
 * Update a platform role's metadata (label, description, color, isStaff).
 */
export const PUT = withErrorHandler(
    async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
        const rateLimited = await withRateLimit(request, 'strict-api');
        if (rateLimited) return rateLimited;

        await requireStaff();
        const { id } = await params;

        const body = await request.json();
        const data = updateSchema.parse(body);

        const { prisma } = await import('@/lib/db');
        const role = await prisma.platformRole.update({
            where: { id },
            data: {
                ...(data.label !== undefined ? { label: data.label } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.isStaff !== undefined ? { isStaff: data.isStaff } : {}),
                ...(data.color !== undefined ? { color: data.color } : {}),
            },
            include: { _count: { select: { users: true } } },
        });

        return apiSuccess({ role });
    },
);

/**
 * DELETE /api/admin/roles/[id]
 * Delete a platform role. Cannot delete roles with assigned users.
 */
export const DELETE = withErrorHandler(
    async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
        const rateLimited = await withRateLimit(request, 'strict-api');
        if (rateLimited) return rateLimited;

        await requireStaff();
        const { id } = await params;

        const { prisma } = await import('@/lib/db');
        const role = await prisma.platformRole.findUnique({
            where: { id },
            include: { _count: { select: { users: true } } },
        });

        if (!role) return apiError(404, 'Role not found');
        if (role._count.users > 0) {
            return apiError(400, 'Cannot delete role with assigned users. Reassign users first.');
        }

        await prisma.platformRole.delete({ where: { id } });
        return new Response(null, { status: 204 });
    },
);
