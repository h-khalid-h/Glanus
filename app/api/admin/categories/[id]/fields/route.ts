import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/validation';
import { createFieldDefinitionRequestSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAdmin } from '@/lib/api/withAuth';
import { AssetCategoryAdminService, CreateFieldInput } from '@/lib/services/AssetCategoryAdminService';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/admin/categories/[id]/fields
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const { id: categoryId } = await params;
    const result = await AssetCategoryAdminService.listCategoryFields(categoryId);
    return apiSuccess(result);
});

// POST /api/admin/categories/[id]/fields
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireAdmin();
    const { id: categoryId } = await params;
    const data = await validateRequest(request, createFieldDefinitionRequestSchema);
    const field = await AssetCategoryAdminService.createCategoryField(categoryId, data as CreateFieldInput);
    return apiSuccess(field, undefined, 201);
});
