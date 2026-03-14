import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { buildOperationalGraph, getBlastRadius } from '@/lib/nerve/operational-graph';

// GET /api/workspaces/[id]/topology - Get workspace infrastructure topology graph
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const url = new URL(request.url);
    const focusNodeId = url.searchParams.get('focus');

    const graph = await buildOperationalGraph(workspaceId);

    // If a focus node is specified, include blast radius data
    let blastRadius: string[] = [];
    if (focusNodeId) {
        blastRadius = getBlastRadius(graph, focusNodeId);
    }

    return apiSuccess({
        graph,
        blastRadius,
        focusNodeId,
    });
});
