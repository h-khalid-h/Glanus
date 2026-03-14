import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { bulkDeleteSchema } from '@/lib/schemas/asset.schemas';
import { AssetBulkService } from '@/lib/services/AssetBulkService';

// POST /api/assets/bulk/delete
export const POST = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();

    const body = await request.json();
    const parsed = bulkDeleteSchema.safeParse(body);
    if (!parsed.success) return apiError(400, parsed.error.errors[0].message);

    try {
        const result = await AssetBulkService.bulkDelete(parsed.data.assetIds, user.id, user.email!);
        return apiSuccess(result);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
