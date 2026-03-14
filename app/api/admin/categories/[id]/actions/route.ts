import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/validation';
import { createActionDefinitionRequestSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAdmin } from '@/lib/api/withAuth';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/admin/categories/[id]/actions
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const { id: categoryId } = await params;
    const data = await validateRequest(request, createActionDefinitionRequestSchema);
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const action = await AssetCategoryAdminService.createCategoryAction(categoryId, data as any);
        return apiSuccess(action, undefined, 201);
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
