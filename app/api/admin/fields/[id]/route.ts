import { withErrorHandler, requireAuth, requireWorkspaceAccess, runWithWorkspaceRLS } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { updateFieldDefinitionSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';
import { withRateLimit } from '@/lib/security/rateLimit';

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/admin/fields/[id]
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    await requireWorkspaceAccess(workspaceId, user.id, request);
    const { id } = await params;
    
    // We parse the body explicitly since updateFieldDefinitionSchema handles the rest
    const data = updateFieldDefinitionSchema.parse(await request.json());
    
    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const field = await AssetCategoryAdminService.updateField(id, data, user.id);
        return apiSuccess(field);
    });
});

// DELETE /api/admin/fields/[id]
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
        const deletedField = await AssetCategoryAdminService.deleteField(id, user.id);
        return apiSuccess({ message: 'Field definition deleted successfully', deletedField });
    });
});
