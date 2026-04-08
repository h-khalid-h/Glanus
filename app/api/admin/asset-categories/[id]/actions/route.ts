import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/validation';
import { createActionDefinitionRequestSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAuth, requireWorkspaceAccess, runWithWorkspaceRLS } from '@/lib/api/withAuth';
import { AssetCategoryAdminService, CreateActionInput } from '@/lib/services/AssetCategoryAdminService';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/admin/asset-categories/[id]/actions
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    await requireWorkspaceAccess(workspaceId, user.id, request);
    const { id: categoryId } = await params;

    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const category = await AssetCategoryAdminService.getCategory(categoryId, workspaceId);
        return apiSuccess(category.actionDefinitions || []);
    });
});

// POST /api/admin/asset-categories/[id]/actions
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    const data = await validateRequest(request, createActionDefinitionRequestSchema) as CreateActionInput;

    await requireWorkspaceAccess(workspaceId, user.id, request);
    const { id: categoryId } = await params;

    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const action = await AssetCategoryAdminService.createCategoryAction(categoryId, data);
        return apiSuccess(action, undefined, 201);
    });
});
