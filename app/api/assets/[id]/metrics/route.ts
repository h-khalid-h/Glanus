import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { AssetService } from '@/lib/services/AssetService';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/assets/[id]/metrics - Get agent metrics for asset
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: assetId } = await params;
    const user = await requireAuth();
    const timeRange = new URL(request.url).searchParams.get('timeRange') || '24h';
    const result = await AssetService.getMetrics(assetId, user.id, timeRange);
    return apiSuccess(result);
});
