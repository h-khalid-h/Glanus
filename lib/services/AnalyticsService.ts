import { prisma } from '@/lib/db';
import { subDays } from 'date-fns';

export class AnalyticsService {
    /**
     * Executes the massive cross-table BI aggregations to compute Dashboard Health.
     */
    static async getWorkspaceAnalytics(workspaceId: string) {
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
                partnerAssignment: {
                    select: {
                        status: true,
                    },
                },
            },
        });

        if (!workspace) {
            throw Object.assign(new Error('Workspace not found'), { statusCode: 404 });
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
            agentList,
            latestMetrics,
            maintenanceUpcoming,
            maintenanceInProgress,
            maintenanceOverdue,
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
            // Agent list (status only — no nested metrics)
            prisma.agentConnection.findMany({
                where: { workspaceId },
                select: { id: true, status: true },
            }),
            // Latest metric per agent — single DISTINCT ON query instead of N+1
            prisma.$queryRaw<Array<{
                agentId: string;
                cpuUsage: number;
                ramUsed: number;
                ramTotal: number;
                diskUsed: number;
                diskTotal: number;
            }>>`
                SELECT DISTINCT ON ("agentId")
                    "agentId", "cpuUsage", "ramUsed", "ramTotal", "diskUsed", "diskTotal"
                FROM "AgentMetric"
                WHERE "agentId" IN (
                    SELECT id FROM "AgentConnection" WHERE "workspaceId" = ${workspaceId}
                )
                ORDER BY "agentId", "timestamp" DESC
            `,
            // Maintenance: upcoming scheduled
            prisma.maintenanceWindow.count({
                where: { workspaceId, status: 'scheduled', scheduledStart: { gte: new Date() } },
            }),
            // Maintenance: currently in progress
            prisma.maintenanceWindow.count({
                where: { workspaceId, status: 'in_progress' },
            }),
            // Maintenance: overdue (scheduled end has passed but still scheduled)
            prisma.maintenanceWindow.count({
                where: { workspaceId, status: 'scheduled', scheduledEnd: { lt: new Date() } },
            }),
        ]);

        // Build a quick-lookup map: agentId → latest metric
        const metricByAgentId = new Map(latestMetrics.map((m) => [m.agentId, m]));

        // Compute system health from agent metrics using the Map built above
        const onlineAgentsWithMetrics = agentList.filter(
            (a) => a.status === 'ONLINE' && metricByAgentId.has(a.id)
        );
        const offlineAgentCount = agentList.filter((a) => a.status === 'OFFLINE').length;
        const errorAgentCount = agentList.filter((a) => a.status === 'ERROR').length;

        let avgCpu = 0, avgRam = 0, avgDisk = 0;
        if (onlineAgentsWithMetrics.length > 0) {
            let cpuSum = 0, ramSum = 0, diskSum = 0;
            for (const agent of onlineAgentsWithMetrics) {
                const m = metricByAgentId.get(agent.id)!;
                cpuSum += m.cpuUsage ?? 0;
                ramSum += m.ramTotal > 0 ? (m.ramUsed / m.ramTotal) * 100 : 0;
                diskSum += m.diskTotal > 0 ? (m.diskUsed / m.diskTotal) * 100 : 0;
            }
            avgCpu = Math.round(cpuSum / onlineAgentsWithMetrics.length);
            avgRam = Math.round(ramSum / onlineAgentsWithMetrics.length);
            avgDisk = Math.round(diskSum / onlineAgentsWithMetrics.length);
        }

        const systemHealth = {
            avgCpu,
            avgRam,
            avgDisk,
            agentsOnline: activeAgents,
            agentsOffline: offlineAgentCount,
            agentsError: errorAgentCount,
            totalAgents,
        };

        // Calculate changes
        const assetChange = assetCount - assetCountPrevious;
        const memberChange = memberCount - memberCountPrevious;

        const alertCounts = {
            info: alerts.find((a) => a.severity === 'INFO')?._count.severity || 0,
            warning: alerts.find((a) => a.severity === 'WARNING')?._count.severity || 0,
            critical: alerts.find((a) => a.severity === 'CRITICAL')?._count.severity || 0,
        };

        const totalAlerts = alertCounts.info + alertCounts.warning + alertCounts.critical;

        // Compute reliability score:
        // Base score of 100, subtract penalties for alerts and offline agents
        const alertPenalty = (alertCounts.critical * 15) + (alertCounts.warning * 5) + (alertCounts.info * 1);
        const agentPenalty = totalAgents > 0
            ? Math.round(((totalAgents - activeAgents) / totalAgents) * 20)
            : 0;
        const reliabilityScore = Math.max(0, Math.min(100, 100 - alertPenalty - agentPenalty));

        return {
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
            systemHealth,
            recentActivity: recentActivity.map((event) => ({
                id: event.id,
                action: event.action,
                resourceType: event.resourceType,
                resourceId: event.resourceId,
                details: event.details,
                userId: event.userId,
                assetId: event.assetId,
                createdAt: event.createdAt,
            })),
            maintenance: {
                upcoming: maintenanceUpcoming,
                inProgress: maintenanceInProgress,
                overdue: maintenanceOverdue,
            },
            partnerAssignment: workspace.partnerAssignment ? {
                status: workspace.partnerAssignment.status,
            } : null,
        };
    }
}
