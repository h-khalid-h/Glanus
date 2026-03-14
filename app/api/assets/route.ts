import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { validateQuery, validateRequest } from '@/lib/validation';
import { assetQuerySchema, createAssetSchema } from '@/lib/schemas/asset.schemas';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AssetService } from '@/lib/services/AssetService';

// GET /api/assets - List assets with filtering and pagination
export const GET = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) {
        return apiError(400, 'Workspace ID required. Please select a workspace.');
    }

    await requireWorkspaceAccess(workspaceId, user.id, request);

    const params = validateQuery(searchParams, assetQuerySchema);

    const data = await AssetService.getAssets(workspaceId, params);

    return apiSuccess(data);
});

// POST /api/assets - Create new asset
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();

    const data = await validateRequest(request, createAssetSchema);
    const workspaceId = (data as Record<string, unknown>).workspaceId as string | undefined;

    if (!workspaceId) {
        return apiError(400, 'Workspace ID is required to create an asset.');
    }

    await requireWorkspaceAccess(workspaceId, user.id, request);

    try {
        const asset = await AssetService.createAsset(workspaceId, user.id, data as any);
        return apiSuccess(asset, undefined, 201);
    } catch (error: any) {
        if (error.message.includes('already exists')) return apiError(409, error.message);
        if (error.message.includes('Quota exceeded')) return apiError(403, error.message);
        return apiError(400, error.message);
    }
});
