import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/validation';
import { createFieldDefinitionRequestSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAuth, requireWorkspaceAccess, runWithWorkspaceRLS } from '@/lib/api/withAuth';
import { AssetCategoryAdminService, CreateFieldInput } from '@/lib/services/AssetCategoryAdminService';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/admin/asset-categories/[id]/fields
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    await requireWorkspaceAccess(workspaceId, user.id, request);
    const { id: categoryId } = await params;

    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const result = await AssetCategoryAdminService.listCategoryFields(categoryId);
        return apiSuccess(result);
    });
});

// POST /api/admin/asset-categories/[id]/fields
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    const data = await validateRequest(request, createFieldDefinitionRequestSchema) as CreateFieldInput;

    await requireWorkspaceAccess(workspaceId, user.id, request);
    const { id: categoryId } = await params;

    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const field = await AssetCategoryAdminService.createCategoryField(categoryId, data);
        return apiSuccess(field, undefined, 201);
    });
});
