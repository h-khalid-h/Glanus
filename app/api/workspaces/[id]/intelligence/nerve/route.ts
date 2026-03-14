import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { enrichMetric } from '@/lib/nerve/enrichment';
import { prisma } from '@/lib/db';

/**
 * GET /api/workspaces/[id]/intelligence/nerve
 *
 * Returns enriched telemetry data for all online agents in the workspace.
 * Intentionally retains the Prisma call here — this is a thin infrastructure
 * projection (online agents list) where the real business logic lives inside
 * `enrichMetric` (lib/nerve/enrichment). No service abstraction needed.
 */
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const params = await context.params;
    const user = await requireAuth();
    await requireWorkspaceRole(params.id, user.id, 'MEMBER');

    const agents = await prisma.agentConnection.findMany({
        where: { workspaceId: params.id, status: 'ONLINE' },
        select: { id: true, cpuUsage: true, ramUsage: true, diskUsage: true },
    });

    const enrichedMetrics = await Promise.all(
        agents.map((agent) =>
            enrichMetric(agent.id, agent.cpuUsage ?? 0, agent.ramUsage ?? 0, agent.diskUsage ?? 0)
        )
    );

    const validMetrics = enrichedMetrics.filter(Boolean);

    return apiSuccess({
        metrics: validMetrics,
        summary: {
            totalAgents: agents.length,
            enrichedCount: validMetrics.length,
            avgHealthScore: validMetrics.length > 0
                ? Math.round(validMetrics.reduce((sum, m) => sum + (m?.healthScore ?? 0), 0) / validMetrics.length)
                : 100,
        },
    });
});
