import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { withRateLimit } from '@/lib/security/rateLimit';
import { buildRiskProfile } from '@/lib/cortex/reasoning';
import { buildOperationalGraph } from '@/lib/nerve/operational-graph';

// GET /api/workspaces/[id]/cortex - Get cortex risk assessment
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    const url = new URL(request.url);
    const assetId = url.searchParams.get('assetId');

    // Build the operational graph
    const graph = await buildOperationalGraph(workspaceId);

    if (assetId) {
        // Single asset risk profile
        try {
            const profile = await buildRiskProfile(assetId, graph);
            return apiSuccess({ profile });
        } catch {
            return apiError(404, 'Asset not found in operational graph');
        }
    }

    // Workspace-wide risk profiles for all asset nodes
    const assetNodes = graph.nodes.filter(n => n.type === 'asset');
    const profiles = await Promise.all(
        assetNodes.slice(0, 20).map(n => // Limit to 20 for perf
            buildRiskProfile(n.id, graph).catch(() => null)
        )
    );

    const validProfiles = profiles.filter(Boolean);
    const avgRisk = validProfiles.length > 0
        ? Math.round(validProfiles.reduce((sum, p) => sum + (p?.riskScore ?? 0), 0) / validProfiles.length)
        : 0;

    return apiSuccess({
        workspaceRiskScore: avgRisk,
        profiles: validProfiles,
        totalAssets: assetNodes.length,
    });
});
