import { apiSuccess } from '@/lib/api/response';
import { ApiError } from '@/lib/errors';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { AssetAssignmentService } from '@/lib/services/AssetAssignmentService';
import { assignAssetSchema } from '@/lib/schemas/asset.schemas';
import { validateRequest } from '@/lib/validation';
import { prisma } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/assets/[id]/assign - Assign asset to user
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id } = await params;
    const user = await requireAuth();

    // Verify user has workspace access to this asset
    const asset = await prisma.asset.findFirst({
        where: { id, deletedAt: null, workspace: { members: { some: { userId: user.id } } } },
        select: { id: true },
    });
    if (!asset) throw new ApiError(404, 'Asset not found');

    const { userId, notes } = await validateRequest(request, assignAssetSchema);
    const result = await AssetAssignmentService.assignAsset(id, user.id, userId, notes);
    return apiSuccess(result);
});
