import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { z } from 'zod';
import { AssetBulkService } from '@/lib/services/AssetBulkService';

const bulkActionSchema = z.object({
    action: z.enum(['update_status', 'delete', 'assign', 'unassign']),
    assetIds: z.array(z.string()).min(1, 'At least one asset ID is required').max(500, 'Maximum 500 assets per batch'),
    payload: z.object({
        status: z.string().optional(),
        assignedToId: z.string().optional(),
    }).optional(),
});

/**
 * POST /api/workspaces/[id]/assets/bulk
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(params.id, user.id);

    const data = bulkActionSchema.parse(await request.json());
    const result = await AssetBulkService.bulkAction(params.id, user.id, data.action, data.assetIds, data.payload);
    return apiSuccess(result, { message: `Bulk ${data.action} completed: ${result.affected} assets affected.` });
});
