import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { AssetService } from '@/lib/services/AssetService';
import { updateAssetSchema } from '@/lib/schemas/asset.schemas';
import { withRateLimit } from '@/lib/security/rateLimit';

// GET /api/assets/[id] - Get single asset
export const GET = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
) => {
    const { id } = await context.params;
    const user = await requireAuth();
    const asset = await AssetService.getAssetById(id, user.id);
    return apiSuccess(asset);
});

// PUT /api/assets/[id] - Update asset
export const PUT = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    const user = await requireAuth();

    const parsed = updateAssetSchema.parse(await request.json());
    const asset = await AssetService.updateAsset(id, user.id, parsed);
    return apiSuccess(asset);
});

// DELETE /api/assets/[id] - Soft delete asset
export const DELETE = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    const user = await requireAuth();
    const asset = await AssetService.deleteAsset(id, user.id);
    return apiSuccess({ message: 'Asset deleted successfully', asset });
});
