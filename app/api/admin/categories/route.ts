import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest, validateQuery } from '@/lib/validation';
import { createCategorySchema, categoryQuerySchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAdmin, requireAuth } from '@/lib/api/withAuth';
import { AssetCategoryAdminService, CategoryQueryInput, CreateCategoryInput } from '@/lib/services/AssetCategoryAdminService';
import { withRateLimit } from '@/lib/security/rateLimit';

// GET /api/admin/categories
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const params = await validateQuery(searchParams, categoryQuerySchema);
    const result = await AssetCategoryAdminService.listCategories(params as CategoryQueryInput);
    return apiSuccess(result);
});

// POST /api/admin/categories
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    await requireAdmin();
    const user = await requireAuth();
    const data = await validateRequest(request, createCategorySchema);
    const category = await AssetCategoryAdminService.createCategory(data as CreateCategoryInput, user.id);
    return apiSuccess(category, undefined, 201);
});

