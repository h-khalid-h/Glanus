import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler, runWithUserRLS } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { requirePermission } from '@/lib/rbac/middleware';
import { createRemoteSessionSchema } from '@/lib/schemas/remote-session.schemas';
import { RemoteSessionService } from '@/lib/services/RemoteSessionService';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/db';

// GET /api/remote/sessions
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    return runWithUserRLS(user, async () => {
        const result = await RemoteSessionService.getSessions({
            userId: user.id,
            status: searchParams.get('status') || undefined,
            assetId: searchParams.get('assetId') || undefined,
            filterUserId: searchParams.get('userId') || undefined,
            page: parseInt(searchParams.get('page') || '1', 10) || 1,
            limit: Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 200),
        });

        return apiSuccess(result);
    });
});

// POST /api/remote/sessions
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();

    const parsed = createRemoteSessionSchema.parse(await request.json());

    // Resolve the asset's workspace so we can enforce the workspace-scoped
    // `remote.connect` permission via the RBAC graph (no legacy role checks).
    const asset = await prisma.asset.findFirst({
        where: {
            id: parsed.assetId,
            deletedAt: null,
            workspace: { members: { some: { userId: user.id } } },
        },
        select: { workspaceId: true },
    });
    if (!asset) {
        throw new ApiError(404, 'Asset not found or access denied');
    }

    await requirePermission(user.id, 'remote', 'connect', asset.workspaceId);

    return runWithUserRLS(user, async () => {
        const session = await RemoteSessionService.createSession({
            userId: user.id,
            assetId: parsed.assetId,
            notes: parsed.notes,
            offer: parsed.offer as Record<string, unknown> | undefined,
            viewOnly: parsed.viewOnly,
        });
        return apiSuccess(session, undefined, 201);
    });
});
