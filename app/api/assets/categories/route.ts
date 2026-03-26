import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/validation';
import { createCategorySchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAuth } from '@/lib/api/withAuth';
import { AssetCategoryAdminService, CreateCategoryInput } from '@/lib/services/AssetCategoryAdminService';
import { withRateLimit } from '@/lib/security/rateLimit';

// GET /api/assets/categories — list categories for the workspace
// Read-only endpoint used by asset creation form; no rate limiting needed
export const GET = withErrorHandler(async (_request: NextRequest) => {
    await requireAuth();

    // Always include fields + children for the Create Asset form
    const result = await AssetCategoryAdminService.listCategories({
        includeFields: true,
        includeActions: false,
        includeChildren: true,
    });

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
