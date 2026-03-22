import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { AssetAssignmentService } from '@/lib/services/AssetAssignmentService';
import { z } from 'zod';

const executeScriptSchema = z.object({
    scriptName: z.string().min(1).max(200),
    scriptBody: z.string().min(1).max(100000),
    language: z.enum(['powershell', 'bash', 'python']),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/assets/[id]/execute-script - Get script execution history
export const GET = withErrorHandler(async (_request: NextRequest, { params }: RouteContext) => {
    const { id: assetId } = await params;
    const user = await requireAuth();
    const result = await AssetAssignmentService.getScriptHistory(assetId, user.id);
    return apiSuccess(result);
});

// POST /api/assets/[id]/execute-script - Execute script on asset
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: assetId } = await params;
    const user = await requireAuth();
    const body = await request.json();
    const data = executeScriptSchema.parse(body);
    const result = await AssetAssignmentService.executeScript(assetId, user.id, data);

    // Offline queued — return 202 Accepted
    if ('queued' in result && result.queued) {
        return apiSuccess({ queued: true, message: result.message }, { status: 202 });
    }

    return apiSuccess(result);
});
