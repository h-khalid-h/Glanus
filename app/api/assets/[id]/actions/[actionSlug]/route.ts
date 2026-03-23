import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { ApiError } from '@/lib/errors';
import { NextRequest } from 'next/server';
import { AssetActionService } from '@/lib/services/AssetActionService';
import { executeActionSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { prisma } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string; actionSlug: string }> };

/** Verify the authenticated user has workspace access to the asset. */
async function requireAssetAccess(assetId: string, userId: string) {
    const asset = await prisma.asset.findFirst({
        where: {
            id: assetId,
            deletedAt: null,
            workspace: { members: { some: { userId } } },
        },
        select: { id: true },
    });
    if (!asset) throw new ApiError(404, 'Asset not found');
}

/**
 * GET /api/assets/{id}/actions/{actionSlug}
 * Get details for a specific action
 */
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const user = await requireAuth();
    const { id, actionSlug } = await params;
    await requireAssetAccess(id, user.id);
    const result = await AssetActionService.getActionBySlug(id, actionSlug);
    return apiSuccess(result);
});

/**
 * POST /api/assets/{id}/actions/{actionSlug}
 * Execute an action on an asset
 */
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const user = await requireAuth();
    const { id, actionSlug } = await params;
    await requireAssetAccess(id, user.id);
    const data = executeActionSchema.parse(await request.json());
    const result = await AssetActionService.executeAction(id, actionSlug, data);
    return apiSuccess(result, undefined, 202); // 202 Accepted
});
