import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { bulkDeleteSchema } from '@/lib/schemas/asset.schemas';
import { AssetBulkService } from '@/lib/services/AssetBulkService';

// POST /api/assets/bulk/delete
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();

    const parsed = bulkDeleteSchema.parse(await request.json());
    const result = await AssetBulkService.bulkDelete(parsed.assetIds, user.id, user.email!);
    return apiSuccess(result);
});
