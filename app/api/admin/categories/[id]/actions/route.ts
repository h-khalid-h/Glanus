import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/validation';
import { createActionDefinitionRequestSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAdmin } from '@/lib/api/withAuth';
import { AssetCategoryAdminService, CreateActionInput } from '@/lib/services/AssetCategoryAdminService';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/admin/categories/[id]/actions
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const { id: categoryId } = await params;
    const data = await validateRequest(request, createActionDefinitionRequestSchema);
    const action = await AssetCategoryAdminService.createCategoryAction(categoryId, data as CreateActionInput);
    return apiSuccess(action, undefined, 201);
});
