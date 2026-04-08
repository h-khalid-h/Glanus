import { withErrorHandler, requireAuth, requireWorkspaceAccess, runWithWorkspaceRLS } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { updateActionDefinitionSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';
import { withRateLimit } from '@/lib/security/rateLimit';

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/admin/actions/[id]
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    await requireWorkspaceAccess(workspaceId, user.id, request);
    const { id } = await params;
    
    // We parse the body explicitly since updateActionDefinitionSchema handles the rest
    const data = updateActionDefinitionSchema.parse(await request.json());
    
    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const action = await AssetCategoryAdminService.updateAction(id, data);
        return apiSuccess(action);
    });
});

// DELETE /api/admin/actions/[id]
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    await requireWorkspaceAccess(workspaceId, user.id, request);
    const { id } = await params;
    
    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const result = await AssetCategoryAdminService.deleteAction(id);
        return apiSuccess(result);
    });
});
