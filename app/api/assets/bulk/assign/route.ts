import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { bulkAssignSchema } from '@/lib/schemas/asset.schemas';
import { AssetBulkService } from '@/lib/services/AssetBulkService';

// POST /api/assets/bulk/assign
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();

    const parsed = bulkAssignSchema.parse(await request.json());
    const result = await AssetBulkService.bulkAssign(parsed.assetIds, parsed.userId, user.id);
    return apiSuccess(result);
});
