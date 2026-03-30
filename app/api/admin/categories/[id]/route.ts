import { withErrorHandler, requireAdmin, requireAuth } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/validation';
import { updateCategorySchema } from '@/lib/schemas/dynamic-asset.schemas';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';
import { withRateLimit } from '@/lib/security/rateLimit';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/admin/categories/[id]
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const { id } = await params;
    const category = await AssetCategoryAdminService.getCategory(id);
    return apiSuccess(category);
});

// PUT /api/admin/categories/[id]
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    await requireAdmin();
    const user = await requireAuth();
    const { id } = await params;
    const data = await validateRequest(request, updateCategorySchema);
    const category = await AssetCategoryAdminService.updateCategory(id, data, user.id);
    return apiSuccess(category);
});

// DELETE /api/admin/categories/[id]
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    await requireAdmin();
    const user = await requireAuth();
    const { id } = await params;
    await AssetCategoryAdminService.deleteCategory(id, user.id);
    return apiSuccess({ message: 'Category deleted successfully' });
});
