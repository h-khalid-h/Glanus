import { prisma } from '@/lib/db';

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
        const [totalAssets, totalUsers, activeSessions, recentInsights] = await Promise.all([
            prisma.asset.count({ where: { workspaceId, deletedAt: null } }),
            prisma.workspaceMember.count({ where: { workspaceId } }),
            prisma.remoteSession.count({ where: { status: 'ACTIVE', asset: { workspaceId } } }),
            prisma.aIInsight.count({ where: { acknowledged: false, asset: { workspaceId } } }),
        ]);

        const recentAssets = await prisma.asset.findMany({
            where: { workspaceId, deletedAt: null },
            take: 5, orderBy: { createdAt: 'desc' },
            include: { assignedTo: { select: { name: true, email: true } } },
        });

        const sessions = await prisma.remoteSession.findMany({
            where: { status: 'ACTIVE', asset: { workspaceId } },
            include: {
                asset: { select: { name: true, category: true } },
                user: { select: { name: true, email: true } },
            },
            take: 10,
        });

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
        const [memberships, ownedWorkspaces] = await Promise.all([
            prisma.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } }),
            prisma.workspace.findMany({ where: { ownerId: userId, deletedAt: null }, select: { id: true } }),
        ]);

        const workspaceIds = [...new Set([
            ...memberships.map((m) => m.workspaceId),
            ...ownedWorkspaces.map((w) => w.id),
        ])];

        const assetIds = await prisma.asset.findMany({
            where: { workspaceId: { in: workspaceIds }, deletedAt: null },
            select: { id: true },
        });

        const insightFilter = {
            OR: [
                { workspaceId: { in: workspaceIds } },
                { assetId: { in: assetIds.map((a) => a.id) } },
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
