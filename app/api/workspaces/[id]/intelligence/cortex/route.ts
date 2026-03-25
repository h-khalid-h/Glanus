import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { analyzeCause, buildRiskProfile } from '@/lib/cortex/reasoning';
import { enrichMetric } from '@/lib/nerve/enrichment';
import { buildOperationalGraph } from '@/lib/nerve/operational-graph';
import { enforceQuota, incrementAICredits } from '@/lib/workspace/quotas';
import { cortexQuerySchema } from '@/lib/schemas/workspace.schemas';
import { withRateLimit } from '@/lib/security/rateLimit';

/**
 * POST /api/workspaces/[id]/intelligence/cortex
 * Body: { agentId: string }
 *
 * Performs causal reasoning on an agent's current state.
 * Uses OpenAI to analyze root cause, causal chain, and remediation.
 */
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const workspaceId = params.id;
    const { agentId } = cortexQuerySchema.parse(await request.json());

    // Enforce AI credit quota
    await enforceQuota(workspaceId, 'ai_credits');

    // Enrich the metric first
    const enriched = await enrichMetric(agentId, 0, 0, 0);
    if (!enriched) {
        return apiError(404, 'Agent not found or has no associated asset');
    }

    // Get operational graph for blast radius analysis
    const graph = await buildOperationalGraph(workspaceId);

    // Run causal analysis
    const analysis = await analyzeCause(enriched, graph);

    // Track AI credit usage
    await incrementAICredits(workspaceId);

    return apiSuccess({
        analysis,
        agent: { id: agentId },
    });
});

/**
 * GET /api/workspaces/[id]/intelligence/cortex?assetId=xxx
 *
 * Returns the risk profile for a specific asset.
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'api');
    if (rateLimited) return rateLimited;

    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const workspaceId = params.id;
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    if (!assetId) {
        return apiError(400, 'assetId query parameter is required');
    }

    const graph = await buildOperationalGraph(workspaceId);
    const riskProfile = await buildRiskProfile(assetId, graph);

    return apiSuccess({ riskProfile });
});
