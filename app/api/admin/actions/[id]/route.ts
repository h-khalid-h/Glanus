import { withErrorHandler, requireAdmin } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { updateActionDefinitionSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';
import { withRateLimit } from '@/lib/security/rateLimit';

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/admin/actions/[id]
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    await requireAdmin();
    const { id } = await params;
    const data = updateActionDefinitionSchema.parse(await request.json());
    const action = await AssetCategoryAdminService.updateAction(id, data);
    return apiSuccess(action);
});

// DELETE /api/admin/actions/[id]
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    await requireAdmin();
    const { id } = await params;
    const result = await AssetCategoryAdminService.deleteAction(id);
    return apiSuccess(result);
});
