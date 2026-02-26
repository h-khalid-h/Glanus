import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { subDays } from 'date-fns';
import { requireAuth, requireWorkspaceAccess, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';

// GET /api/workspaces/[id]/analytics - Get workspace analytics + mission control data
export const GET = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id: workspaceId } = await context.params;
    const user = await requireAuth();
    await requireWorkspaceAccess(workspaceId, user.id);

    // Get workspace with subscription data
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
            subscription: {
                select: {
                    plan: true,
                    maxAssets: true,
                    maxAICreditsPerMonth: true,
                    aiCreditsUsed: true,
                    maxStorageMB: true,
                    storageUsedMB: true,
                },
            },
        },
    });

    if (!workspace) {
        return apiError(404, 'Workspace not found');
    }

    const thirtyDaysAgo = subDays(new Date(), 30);

    // Run all count queries in parallel for performance
    const [
        assetCount,
        assetCountPrevious,
        memberCount,
        memberCountPrevious,
        activeAgents,
        totalAgents,
        alerts,
        recentActivity,
    ] = await Promise.all([
        // Current asset count
        prisma.asset.count({
            where: { workspaceId },
        }),
        // Asset count 30 days ago
        prisma.asset.count({
            where: {
                workspaceId,
                createdAt: { lt: thirtyDaysAgo },
            },
        }),
        // Current member count
        prisma.workspaceMember.count({
            where: { workspaceId },
        }),
        // Member count 30 days ago
        prisma.workspaceMember.count({
            where: {
                workspaceId,
                joinedAt: { lt: thirtyDaysAgo },
            },
        }),
        // Active agents (online)
        prisma.agentConnection.count({
            where: { workspaceId, status: 'ONLINE' },
        }),
        // Total agents
        prisma.agentConnection.count({
            where: { workspaceId },
        }),
        // Alert counts by severity
        prisma.alertRule.groupBy({
            by: ['severity'],
            where: {
                workspaceId,
                enabled: true,
            },
            _count: {
                severity: true,
            },
        }),
        // Recent audit log activity (real data)
        prisma.auditLog.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        }),
    ]);

    // Calculate changes
    const assetChange = assetCount - assetCountPrevious;
    const memberChange = memberCount - memberCountPrevious;

    const alertCounts = {
        info: alerts.find(a => a.severity === 'INFO')?._count.severity || 0,
        warning: alerts.find(a => a.severity === 'WARNING')?._count.severity || 0,
        critical: alerts.find(a => a.severity === 'CRITICAL')?._count.severity || 0,
    };

    const totalAlerts = alertCounts.info + alertCounts.warning + alertCounts.critical;

    // Compute reliability score:
    // Base score of 100, subtract penalties for alerts and offline agents
    const alertPenalty = (alertCounts.critical * 15) + (alertCounts.warning * 5) + (alertCounts.info * 1);
    const agentPenalty = totalAgents > 0
        ? Math.round(((totalAgents - activeAgents) / totalAgents) * 20)
        : 0;
    const reliabilityScore = Math.max(0, Math.min(100, 100 - alertPenalty - agentPenalty));

    const analytics = {
        // Mission Control data
        workspaceName: workspace.name,
        plan: workspace.subscription?.plan || 'free',
        reliabilityScore,
        activeAgents,
        totalAgents,
        alertCount: totalAlerts,

        // Legacy analytics data
        assetCount: {
            current: assetCount,
            change: assetChange,
            changePercent: assetCountPrevious > 0
                ? Math.round((assetChange / assetCountPrevious) * 100)
                : assetCount > 0 ? 100 : 0,
        },
        memberCount: {
            current: memberCount,
            change: memberChange,
            changePercent: memberCountPrevious > 0
                ? Math.round((memberChange / memberCountPrevious) * 100)
                : memberCount > 0 ? 100 : 0,
        },
        aiCreditsUsed: {
            current: workspace.subscription?.aiCreditsUsed || 0,
            limit: workspace.subscription?.maxAICreditsPerMonth || 0,
            percentUsed: workspace.subscription?.maxAICreditsPerMonth
                ? Math.round((workspace.subscription.aiCreditsUsed / workspace.subscription.maxAICreditsPerMonth) * 100)
                : 0,
        },
        storageUsed: {
            current: workspace.subscription?.storageUsedMB || 0,
            limit: workspace.subscription?.maxStorageMB || 1024,
            percentUsed: workspace.subscription?.maxStorageMB
                ? Math.round(((workspace.subscription?.storageUsedMB || 0) / workspace.subscription.maxStorageMB) * 100)
                : 0,
        },
        alerts: alertCounts,
        recentActivity: recentActivity.map(event => ({
            id: event.id,
            action: event.action,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            details: event.details,
            userId: event.userId,
            assetId: event.assetId,
            createdAt: event.createdAt.toISOString(),
        })),
    };

    return apiSuccess(analytics);
});
