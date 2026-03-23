import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { AssetActionService } from '@/lib/services/AssetActionService';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/executions/{id}
 * Poll execution status — verifies workspace membership via the execution's asset.
 */
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const user = await requireAuth();
    const { id } = await params;
    const execution = await AssetActionService.getExecution(id, user.id);
    return apiSuccess(execution);
});
