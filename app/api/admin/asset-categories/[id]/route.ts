import { withErrorHandler, requireAuth, runWithWorkspaceRLS, requireWorkspaceAccess } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/validation';
import { updateCategorySchema } from '@/lib/schemas/dynamic-asset.schemas';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/admin/categories/[id]
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    await requireWorkspaceAccess(workspaceId, user.id, request);
    const { id } = await params;

    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const category = await AssetCategoryAdminService.getCategory(id, workspaceId);
        return apiSuccess(category);
    });
});

// PUT /api/admin/categories/[id]
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth();
    
    // For PUT, body parsing
    const data = await validateRequest(request, updateCategorySchema) as any;
    const workspaceId = data.workspaceId;
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    await requireWorkspaceAccess(workspaceId, user.id, request);
    const { id } = await params;

    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const category = await AssetCategoryAdminService.updateCategory(id, data, user.id, workspaceId);
        return apiSuccess(category);
    });
});

// DELETE /api/admin/categories/[id]
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    await requireWorkspaceAccess(workspaceId, user.id, request);
    const { id } = await params;

    return runWithWorkspaceRLS(workspaceId, user, async () => {
        await AssetCategoryAdminService.deleteCategory(id, user.id, workspaceId);
        return apiSuccess({ message: 'Category deleted successfully' });
    });
});
