import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { validateRequest, validateQuery } from '@/lib/validation';
import { createCategorySchema, categoryQuerySchema } from '@/lib/schemas/dynamic-asset.schemas';
import { withErrorHandler, requireAuth, runWithWorkspaceRLS, requireWorkspaceAccess } from '@/lib/api/withAuth';
import { AssetCategoryAdminService, CategoryQueryInput, CreateCategoryInput } from '@/lib/services/AssetCategoryAdminService';
import { withRateLimit } from '@/lib/security/rateLimit';

// GET /api/admin/categories
export const GET = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    await requireWorkspaceAccess(workspaceId, user.id, request);
    
    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const params = await validateQuery(searchParams, categoryQuerySchema);
        const result = await AssetCategoryAdminService.listCategories(params as CategoryQueryInput, workspaceId);
        return apiSuccess(result);
    });
});

// POST /api/admin/categories
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return apiError(400, 'Workspace ID required');

    const data = await validateRequest(request, createCategorySchema) as CreateCategoryInput;

    await requireWorkspaceAccess(workspaceId, user.id, request);
    
    return runWithWorkspaceRLS(workspaceId, user, async () => {
        const category = await AssetCategoryAdminService.createCategory(data, user.id, workspaceId);
        return apiSuccess(category, undefined, 201);
    });
});

