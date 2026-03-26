import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { WorkspaceSearchService } from '@/lib/services/WorkspaceSearchService';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/workspaces/[id]/search?q=<query>&limit=5
 *
 * Unified search across workspace entities:
 *   - Assets (name, serial number, location)
 *   - Agents (hostname, IP address)
 *   - AI Insights (title, description)
 */
export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10) || 5, 50);

    const result = await WorkspaceSearchService.search(workspaceId, q, limit);
    return apiSuccess(result);
});
