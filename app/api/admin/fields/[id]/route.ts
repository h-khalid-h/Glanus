import { withErrorHandler, requireAdmin, requireAuth } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { updateFieldDefinitionSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/admin/fields/[id]
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const data = updateFieldDefinitionSchema.parse(body);
    try {
        const field = await AssetCategoryAdminService.updateField(id, data, user.id);
        return apiSuccess(field);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// DELETE /api/admin/fields/[id]
export const DELETE = withErrorHandler(async (_request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const user = await requireAuth();
    const { id } = await params;
    try {
        const deletedField = await AssetCategoryAdminService.deleteField(id, user.id);
        return apiSuccess({ message: 'Field definition deleted successfully', deletedField });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
