import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { AssetActionService } from '@/lib/services/AssetActionService';
import { executeActionSchema } from '@/lib/schemas/dynamic-asset.schemas';

type RouteContext = { params: Promise<{ id: string; actionSlug: string }> };

/**
 * GET /api/assets/{id}/actions/{actionSlug}
 * Get details for a specific action
 */
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    await requireAuth();
    const { id, actionSlug } = await params;
    const result = await AssetActionService.getActionBySlug(id, actionSlug);
    return apiSuccess(result);
});

/**
 * POST /api/assets/{id}/actions/{actionSlug}
 * Execute an action on an asset
 */
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    await requireAuth();
    const { id, actionSlug } = await params;
    const data = executeActionSchema.parse(await request.json());
    const result = await AssetActionService.executeAction(id, actionSlug, data);
    return apiSuccess(result, undefined, 202); // 202 Accepted
});
