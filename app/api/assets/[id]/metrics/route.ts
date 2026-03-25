import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AssetAnalyticsService } from '@/lib/services/AssetAnalyticsService';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/assets/[id]/metrics - Get agent metrics for asset
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const { id: assetId } = await params;
    const user = await requireAuth();
    const timeRange = new URL(request.url).searchParams.get('timeRange') || '24h';
    const result = await AssetAnalyticsService.getMetrics(assetId, user.id, timeRange);
    return apiSuccess(result);
});
