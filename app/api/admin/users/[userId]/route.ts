import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { SuperAdminUserService } from '@/lib/services/SuperAdminUserService';
import { z } from 'zod';
import type { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { logInfo, logWarn } from '@/lib/logger';

/**
 * GET /api/admin/users/[userId]
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> },
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    const { userId } = await context.params;
    const detail = await SuperAdminUserService.getUserDetail(userId);
    return apiSuccess({ user: detail });
});

const updateSchema = z.object({
    name:           z.string().min(1).max(200).optional(),
    email:          z.string().email().optional(),
    role:           z.enum(['USER', 'IT_STAFF', 'ADMIN']).optional(),
    platformRoleId: z.string().min(1).optional(),
    isStaff:        z.boolean().optional(),
    password:       z.string().min(8).optional(),
}).refine((data) => data.name !== undefined || data.email !== undefined || data.role !== undefined || data.isStaff !== undefined || data.platformRoleId !== undefined || data.password !== undefined, {
    message: 'Provide at least one field to update',
});

/**
 * PATCH /api/admin/users/[userId]
 * Update role or staff access.
 */
export const PATCH = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> },
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const actor = await requireStaff();
    const { userId } = await context.params;

    const body = await request.json();
    const parsed = updateSchema.parse(body);

    // Update name/email if provided
    if (parsed.name !== undefined || parsed.email !== undefined) {
        const data: Record<string, string> = {};
        if (parsed.name !== undefined) data.name = parsed.name.trim();
        if (parsed.email !== undefined) {
            const normalized = parsed.email.toLowerCase().trim();
            const existing = await prisma.user.findFirst({
                where: { email: normalized, id: { not: userId } },
            });
            if (existing) {
                return new Response(JSON.stringify({ error: { message: 'Email already in use by another user' } }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            data.email = normalized;
        }
        await prisma.user.update({ where: { id: userId }, data });
    }

    if (parsed.platformRoleId) {
        // Dynamic role assignment — syncs isStaff and enum role automatically
        await SuperAdminUserService.assignPlatformRole(userId, parsed.platformRoleId, actor.id);
    } else if (parsed.role !== undefined) {
        await SuperAdminUserService.updateUserRole(userId, parsed.role as UserRole, actor.id);
    }

    if (parsed.isStaff !== undefined && !parsed.platformRoleId && parsed.role === undefined) {
        await SuperAdminUserService.setStaffAccess(userId, parsed.isStaff, actor.id);
    }

    // Admin password reset — sets mustChangePassword so user is forced to change on next login
    if (parsed.password) {
        const hashed = await bcrypt.hash(parsed.password, 12);
        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashed,
                mustChangePassword: true,
                passwordChangedAt: null,
            },
        });

        try {
            await prisma.auditLog.create({
                data: {
                    action: 'ADMIN_PASSWORD_RESET',
                    resourceType: 'User',
                    resourceId: userId,
                    userId: actor.id,
                    metadata: { resetBy: actor.id, resetAt: new Date().toISOString() },
                },
            });
        } catch (err) {
            logWarn('[ADMIN] Audit log failed for admin password reset', {
                error: err instanceof Error ? err.message : String(err),
            });
        }

        logInfo(`[ADMIN] Super admin ${actor.email} reset password for user ${userId} (forced change on next login)`);
    }

    const updated = await SuperAdminUserService.getUserDetail(userId);
    return apiSuccess({ user: updated });
});
