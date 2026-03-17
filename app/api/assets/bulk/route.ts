import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { bulkOpsSchema } from '@/lib/schemas/asset.schemas';
import { AssetBulkService } from '@/lib/services/AssetBulkService';
import { ApiError } from '@/lib/errors';

// POST /api/assets/bulk - Bulk operations on assets
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();
    const parsed = bulkOpsSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(400, parsed.error.errors[0].message);

    const { operation, assetIds, data } = parsed.data;

    switch (operation) {
        case 'DELETE':
            return apiSuccess(await AssetBulkService.bulkDelete(assetIds, user.id, user.email!));

        case 'UPDATE':
            if (!data) return apiError(400, 'Update operation requires data');
            return apiSuccess(await AssetBulkService.bulkUpdate(assetIds, user.id, {
                status: data.status,
                location: data.location,
            }));

        case 'ASSIGN':
            if (!data?.assigneeId) return apiError(400, 'Assign operation requires assigneeId');
            return apiSuccess(await AssetBulkService.bulkAssign(assetIds, data.assigneeId, user.id));

        default:
            throw new ApiError(400, `Unknown bulk operation: ${operation}`);
    }
});
