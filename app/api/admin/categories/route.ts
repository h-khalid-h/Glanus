import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest, validateQuery } from '@/lib/validation';
import { createCategorySchema, categoryQuerySchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAdmin, requireAuth } from '@/lib/api/withAuth';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';

// GET /api/admin/categories
export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const params = await validateQuery(searchParams, categoryQuerySchema);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await AssetCategoryAdminService.listCategories(params as any);
    return apiSuccess(result);
});

// POST /api/admin/categories
export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireAdmin();
    const user = await requireAuth();
    const data = await validateRequest(request, createCategorySchema);
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const category = await AssetCategoryAdminService.createCategory(data as any, user.id);
        return apiSuccess(category, undefined, 201);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

