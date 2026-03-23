import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { ApiError } from '@/lib/errors';
import { NextRequest } from 'next/server';
import { AssetAnalyticsService } from '@/lib/services/AssetAnalyticsService';
import { prisma } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

/** Verify the authenticated user has workspace access to the asset. */
async function requireAssetAccess(assetId: string, userId: string) {
    const asset = await prisma.asset.findFirst({
        where: { id: assetId, deletedAt: null, workspace: { members: { some: { userId } } } },
        select: { id: true },
    });
    if (!asset) throw new ApiError(404, 'Asset not found');
}

/**
 * GET /api/assets/{id}/schema
 * Returns the complete schema for an asset including:
 * - Category information
 * - All field definitions (inherited + direct)
 * - All available actions
 * - Current field values
 */
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const user = await requireAuth();
    const { id: assetId } = await params;
    await requireAssetAccess(assetId, user.id);
    const result = await AssetAnalyticsService.getSchema(assetId);
    return apiSuccess(result);
});
