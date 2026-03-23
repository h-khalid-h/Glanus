import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { ApiError } from '@/lib/errors';
import { NextRequest } from 'next/server';
import { AssetActionService } from '@/lib/services/AssetActionService';
import { prisma } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/assets/[id]/actions - List available actions for an asset
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const user = await requireAuth();
    const { id: assetId } = await params;

    // Verify user has workspace access to this asset
    const asset = await prisma.asset.findFirst({
        where: { id: assetId, deletedAt: null, workspace: { members: { some: { userId: user.id } } } },
        select: { id: true },
    });
    if (!asset) throw new ApiError(404, 'Asset not found');

    const result = await AssetActionService.listActions(assetId);
    return apiSuccess(result);
});
