import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { AssetService } from '@/lib/services/AssetService';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/assets/[id]/actions - List available actions for an asset
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    await requireAuth();
    const { id: assetId } = await params;
    const result = await AssetService.listActions(assetId);
    return apiSuccess(result);
});
