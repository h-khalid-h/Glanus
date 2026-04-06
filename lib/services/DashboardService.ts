import { prisma } from '@/lib/db';
import { dashboardCache } from '@/lib/cache';

/**
 * DashboardService — Domain layer for dashboard aggregations.
 *
 * Encapsulates:
 *   - Per-workspace dashboard stats (assets, members, active sessions, pending insights, recent assets)
 *   - Cross-workspace AI insight aggregation (recent insights, severity breakdown, counts)
 */
export class DashboardService {

    // ========================================
    // WORKSPACE DASHBOARD
    // ========================================

    static async getDashboard(workspaceId: string) {
        const cacheKey = `dash:${workspaceId}`;
        const cached = dashboardCache.get<Awaited<ReturnType<typeof DashboardService._getDashboardUncached>>>(cacheKey);
        if (cached) return cached;

        const result = await DashboardService._getDashboardUncached(workspaceId);
        dashboardCache.set(cacheKey, result, 30_000); // 30s TTL
        return result;
    }

    private static async _getDashboardUncached(workspaceId: string) {
        const [totalAssets, totalUsers, activeSessions, recentInsights, recentAssets, sessions] = await Promise.all([
            prisma.asset.count({ where: { workspaceId, deletedAt: null } }),
            prisma.workspaceMember.count({ where: { workspaceId } }),
            prisma.remoteSession.count({ where: { status: 'ACTIVE', asset: { workspaceId } } }),
            prisma.aIInsight.count({ where: { acknowledged: false, asset: { workspaceId } } }),
            prisma.asset.findMany({
                where: { workspaceId, deletedAt: null },
                take: 5, orderBy: { createdAt: 'desc' },
                include: { assignedTo: { select: { name: true, email: true } } },
            }),
            prisma.remoteSession.findMany({
                where: { status: 'ACTIVE', asset: { workspaceId } },
                include: {
                    asset: { select: { name: true, category: true } },
                    user: { select: { name: true, email: true } },
                },
                take: 10,
            }),
        ]);

        return {
            stats: { totalAssets, totalUsers, activeSessions, pendingInsights: recentInsights },
            recentAssets,
            activeSessions: sessions,
        };
    }

    // ========================================
    // CROSS-WORKSPACE AI INSIGHTS
    // ========================================

    static async getCrossWorkspaceInsights(userId: string) {
        const cacheKey = `insights:${userId}`;
        const cached = dashboardCache.get<Awaited<ReturnType<typeof DashboardService._getCrossWorkspaceInsightsUncached>>>(cacheKey);
        if (cached) return cached;

        const result = await DashboardService._getCrossWorkspaceInsightsUncached(userId);
        dashboardCache.set(cacheKey, result, 30_000); // 30s TTL
        return result;
    }

    private static async _getCrossWorkspaceInsightsUncached(userId: string) {
        const [memberships, ownedWorkspaces] = await Promise.all([
            prisma.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } }),
            prisma.workspace.findMany({ where: { ownerId: userId, deletedAt: null }, select: { id: true } }),
        ]);

        const workspaceIds = [...new Set([
            ...memberships.map((m) => m.workspaceId),
            ...ownedWorkspaces.map((w) => w.id),
        ])];

        // Filter insights by workspace directly — avoids fetching ALL asset IDs
        const insightFilter = {
            OR: [
                { workspaceId: { in: workspaceIds } },
                { asset: { workspaceId: { in: workspaceIds } } },
                { userId },
            ],
        };

        const [insights, severityCounts, totalCount, unacknowledgedCount] = await Promise.all([
            prisma.aIInsight.findMany({
                where: insightFilter, orderBy: { createdAt: 'desc' }, take: 20,
                include: { asset: { select: { id: true, name: true, status: true } } },
            }),
            prisma.aIInsight.groupBy({ by: ['severity'], where: insightFilter, _count: true }),
            prisma.aIInsight.count({ where: insightFilter }),
            prisma.aIInsight.count({ where: { acknowledged: false, ...insightFilter } }),
        ]);

        const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        for (const group of severityCounts) {
            const key = (group.severity || 'info').toLowerCase();
            if (key in severityBreakdown) {
                severityBreakdown[key as keyof typeof severityBreakdown] = group._count;
            }
        }

        return {
            insights,
            summary: { total: totalCount, unacknowledged: unacknowledgedCount, severity: severityBreakdown, workspaceCount: workspaceIds.length },
        };
    }
}
