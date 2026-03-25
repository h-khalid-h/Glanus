import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { WorkspaceSubFeatureService } from '@/lib/services/WorkspaceSubFeatureService';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/workspaces/[id]/export
 * Export workspace data as JSON or CSV for compliance and backup.
 *
 * Query params:
 *   - format: 'json' (default) or 'csv'
 *   - scope: 'all' (default), 'assets', 'agents', 'alerts', 'audit'
 */
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const scope = url.searchParams.get('scope') || 'all';

    return WorkspaceSubFeatureService.exportWorkspace(workspaceId, user.id, format, scope);
});
