import { withErrorHandler, requireAdmin } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { updateActionDefinitionSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/admin/actions/[id]
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = updateActionDefinitionSchema.parse(body);
    try {
        const action = await AssetCategoryAdminService.updateAction(id, data);
        return apiSuccess(action);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});

// DELETE /api/admin/actions/[id]
export const DELETE = withErrorHandler(async (_request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const { id } = await params;
    try {
        const result = await AssetCategoryAdminService.deleteAction(id);
        return apiSuccess(result);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
