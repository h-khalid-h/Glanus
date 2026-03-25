import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest, validateQuery } from '@/lib/validation';
import { createCategorySchema, categoryQuerySchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAuth } from '@/lib/api/withAuth';
import { AssetCategoryAdminService, CategoryQueryInput, CreateCategoryInput } from '@/lib/services/AssetCategoryAdminService';
import { withRateLimit } from '@/lib/security/rateLimit';

// GET /api/assets/categories — list categories for the workspace
// Reuses the admin service but only requires authentication (not admin role)
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    await requireAuth();
    const { searchParams } = new URL(request.url);
    const params = await validateQuery(searchParams, categoryQuerySchema);
    const result = await AssetCategoryAdminService.listCategories(params as CategoryQueryInput);
    // Frontend expects data.data to be a flat array of categories
    return apiSuccess(result.categories);
});

// POST /api/assets/categories — create a new category (requires auth)
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const data = await validateRequest(request, createCategorySchema);
    const category = await AssetCategoryAdminService.createCategory(data as CreateCategoryInput, user.id);
    return apiSuccess(category, undefined, 201);
});
