import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { WorkspaceAuditService } from '@/lib/services/WorkspaceAuditService';
import { withRateLimit } from '@/lib/security/rateLimit';

// GET /api/workspaces/[id]/audit/export
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();

    const rateLimitResponse = await withRateLimit(request, 'api');
    if (rateLimitResponse) return rateLimitResponse;

    await WorkspaceAuditService.verifyAdminAccess(user.id, workspaceId);

    const { searchParams } = new URL(request.url);
    const result = await WorkspaceAuditService.exportLogs(workspaceId, {
        format: searchParams.get('format'),
        action: searchParams.get('action'),
        resourceType: searchParams.get('resourceType'),
        startDate: searchParams.get('startDate'),
        endDate: searchParams.get('endDate'),
    });

    const contentType = result.format === 'json' ? 'application/json' : 'text/csv';
    return new Response(result.content, {
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${result.filename}"`,
        },
    });
});
