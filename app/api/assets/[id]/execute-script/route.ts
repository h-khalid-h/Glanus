import { apiSuccess } from '@/lib/api/response';
import { ApiError } from '@/lib/errors';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { AssetAssignmentService } from '@/lib/services/AssetAssignmentService';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const executeScriptSchema = z.object({
    scriptName: z.string().min(1).max(200),
    scriptBody: z.string().min(1).max(100000),
    language: z.enum(['powershell', 'bash', 'python']),
});

type RouteContext = { params: Promise<{ id: string }> };

/** Verify the authenticated user has workspace access to the asset. */
async function requireAssetAccess(assetId: string, userId: string) {
    const asset = await prisma.asset.findFirst({
        where: { id: assetId, deletedAt: null, workspace: { members: { some: { userId } } } },
        select: { id: true },
    });
    if (!asset) throw new ApiError(404, 'Asset not found');
}

// GET /api/assets/[id]/execute-script - Get script execution history
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const { id: assetId } = await params;
    const user = await requireAuth();
    await requireAssetAccess(assetId, user.id);
    const result = await AssetAssignmentService.getScriptHistory(assetId, user.id);
    return apiSuccess(result);
});

// POST /api/assets/[id]/execute-script - Execute script on asset
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: assetId } = await params;
    const user = await requireAuth();
    await requireAssetAccess(assetId, user.id);
    const body = await request.json();
    const data = executeScriptSchema.parse(body);
    const result = await AssetAssignmentService.executeScript(assetId, user.id, data);

    // Offline queued — return 202 Accepted
    if ('queued' in result && result.queued) {
        return apiSuccess({ queued: true, message: result.message }, undefined, 202);
    }

    return apiSuccess(result);
});
