import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { WorkspaceAuditService } from '@/lib/services/WorkspaceAuditService';

// GET /api/workspaces/[id]/audit
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();

    await WorkspaceAuditService.verifyAdminAccess(user.id, workspaceId);

    const { searchParams } = new URL(request.url);
    const result = await WorkspaceAuditService.getLogs(workspaceId, {
        page: parseInt(searchParams.get('page') || '1', 10),
        limit: parseInt(searchParams.get('limit') || '50', 10),
        userId: searchParams.get('userId'),
        action: searchParams.get('action'),
        resourceType: searchParams.get('resourceType'),
        assetId: searchParams.get('assetId'),
        startDate: searchParams.get('startDate'),
        endDate: searchParams.get('endDate'),
    });

    return apiSuccess(result);
});
