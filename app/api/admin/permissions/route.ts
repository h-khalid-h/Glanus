import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireStaff, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { PermissionService } from '@/lib/services/PermissionService';
import { z } from 'zod';

/**
 * GET /api/admin/permissions
 * Returns all platform permissions, optionally filtered by scope.
 * Used by the permission matrix UI.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');
    const validScopes = ['PLATFORM', 'WORKSPACE'] as const;
    const scopeFilter = scope && validScopes.includes(scope as (typeof validScopes)[number])
        ? (scope as (typeof validScopes)[number])
        : undefined;

    const grouped = url.searchParams.get('grouped') === 'true';

    if (grouped) {
        const matrix = await PermissionService.getPermissionMatrix(scopeFilter);
        return apiSuccess({ permissions: matrix });
    }

    const permissions = await PermissionService.listPermissions(scopeFilter);
    return apiSuccess({ permissions });
});

const seedSchema = z.object({ action: z.literal('seed') });

/**
 * POST /api/admin/permissions
 * Seed the permission catalogue. Idempotent — safe to call multiple times.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    await requireStaff();

    const body = await request.json();
    seedSchema.parse(body);

    await PermissionService.bootstrap();
    return apiSuccess({ message: 'Permissions seeded successfully' }, undefined, 201);
});
