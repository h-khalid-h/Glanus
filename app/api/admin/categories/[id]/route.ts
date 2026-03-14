import { withErrorHandler, requireAdmin, requireAuth } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/validation';
import { updateCategorySchema } from '@/lib/schemas/dynamic-asset.schemas';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/admin/categories/[id]
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const { id } = await params;
    try {
        const category = await AssetCategoryAdminService.getCategory(id);
        return apiSuccess(category);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// PUT /api/admin/categories/[id]
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const user = await requireAuth();
    const { id } = await params;
    const data = await validateRequest(request, updateCategorySchema);
    try {
        const category = await AssetCategoryAdminService.updateCategory(id, data, user.id);
        return apiSuccess(category);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// DELETE /api/admin/categories/[id]
export const DELETE = withErrorHandler(async (_request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const user = await requireAuth();
    const { id } = await params;
    try {
        await AssetCategoryAdminService.deleteCategory(id, user.id);
        return apiSuccess({ message: 'Category deleted successfully' });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
