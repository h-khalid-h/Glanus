import { withErrorHandler, requireAdmin, requireAuth } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { updateFieldDefinitionSchema } from '@/lib/schemas/dynamic-asset.schemas';
import { AssetCategoryAdminService } from '@/lib/services/AssetCategoryAdminService';
import { withRateLimit } from '@/lib/security/rateLimit';

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/admin/fields/[id]
export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    await requireAdmin();
    const user = await requireAuth();
    const { id } = await params;
    const data = updateFieldDefinitionSchema.parse(await request.json());
    const field = await AssetCategoryAdminService.updateField(id, data, user.id);
    return apiSuccess(field);
});

// DELETE /api/admin/fields/[id]
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    await requireAdmin();
    const user = await requireAuth();
    const { id } = await params;
    const deletedField = await AssetCategoryAdminService.deleteField(id, user.id);
    return apiSuccess({ message: 'Field definition deleted successfully', deletedField });
});
