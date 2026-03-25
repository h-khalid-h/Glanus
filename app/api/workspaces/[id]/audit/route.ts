import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceAuditService } from '@/lib/services/WorkspaceAuditService';

// GET /api/workspaces/[id]/audit
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId } = await context.params;
    const user = await requireAuth();

    await WorkspaceAuditService.verifyAdminAccess(user.id, workspaceId);

    const { searchParams } = new URL(request.url);
    const result = await WorkspaceAuditService.getLogs(workspaceId, {
        page: parseInt(searchParams.get('page') || '1', 10),
        limit: Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200),
        userId: searchParams.get('userId'),
        action: searchParams.get('action'),
        resourceType: searchParams.get('resourceType'),
        assetId: searchParams.get('assetId'),
        startDate: searchParams.get('startDate'),
        endDate: searchParams.get('endDate'),
    });

    return apiSuccess(result);
});
