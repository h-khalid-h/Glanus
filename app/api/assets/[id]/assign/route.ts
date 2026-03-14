import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { AssetAssignmentService } from '@/lib/services/AssetAssignmentService';
import { assignAssetSchema } from '@/lib/schemas/asset.schemas';
import { validateRequest } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/assets/[id]/assign - Assign asset to user
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id } = await params;
    const user = await requireAuth();
    const { userId, notes } = await validateRequest(request, assignAssetSchema);
    const asset = await AssetAssignmentService.assignAsset(id, user.id, userId, notes);
    return apiSuccess(asset);
});
