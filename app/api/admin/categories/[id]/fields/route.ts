import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/validation';
import { createFieldDefinitionRequestSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAdmin } from '@/lib/api/withAuth';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/admin/categories/[id]/fields
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const { id: categoryId } = await params;
    try {
        const result = await AssetCategoryAdminService.listCategoryFields(categoryId);
        return apiSuccess(result);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// POST /api/admin/categories/[id]/fields
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const { id: categoryId } = await params;
    const data = await validateRequest(request, createFieldDefinitionRequestSchema);
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const field = await AssetCategoryAdminService.createCategoryField(categoryId, data as any);
        return apiSuccess(field, undefined, 201);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
