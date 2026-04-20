/**
 * SuperAdminService — Platform-wide aggregation for super-admin users.
 *
 * All methods bypass per-workspace RLS by querying without a workspaceId filter.
 * SECURITY: Every API route that calls these methods MUST first call requireAdmin().
 *
 * Caching strategy:
 *   - KPIs:          60 s  (acceptable staleness for a live dashboard)
 *   - Workspace list: 30 s
 *   - Analytics:     120 s (heavy GROUP BY queries)
 */

import { prisma } from '@/lib/db';
import { dashboardCache } from '@/lib/cache';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlatformKPIs {
    totalWorkspaces: number;
    totalUsers: number;
    activeWorkspaces24h: number;
    totalAssets: number;
    openTickets: number;
    totalAgents: number;
    onlineAgents: number;
}

export interface WorkspaceRow {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    ownerName: string | null;
    ownerEmail: string | null;
    plan: string | null;
    status: string | null;
    createdAt: Date;
    userCount: number;
    assetCount: number;
    agentCount: number;
    lastActivity: Date | null;
}

export interface WorkspaceListResult {
    workspaces: WorkspaceRow[];
    total: number;
}

export interface DayActivity {
    workspaceId: string;
    workspaceName: string;
    day: string; // ISO date string
    events: number;
}

export interface WorkspaceUsage {
    workspaceId: string;
    workspaceName: string;
    assetCount: number;
    userCount: number;
    agentCount: number;
    auditEvents: number;
    openTickets: number;
}

export interface UsageAnalytics {
    activityByDay: DayActivity[];
    workspaceUsage: WorkspaceUsage[];
    topByAssets: WorkspaceUsage[];
    topByActivity: WorkspaceUsage[];
}

export interface RecentAuditEvent {
    id: string;
    workspaceId: string | null;
    workspaceName: string | null;
    userId: string | null;
    userEmail: string | null;
    action: string;
    resourceType: string | null;
    createdAt: Date;
}

export interface PlatformAlert {
    type: 'high_activity' | 'spike' | 'no_activity';
    workspaceId: string;
    workspaceName: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    value: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class SuperAdminService {

    // =========================================================================
    // PLATFORM KPIs
    // =========================================================================

    static async getPlatformKPIs(): Promise<PlatformKPIs> {
        const cacheKey = 'super:kpis';
        const cached = dashboardCache.get<PlatformKPIs>(cacheKey);
        if (cached) return cached;

        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [
            totalWorkspaces,
            totalUsers,
            totalAssets,
            openTickets,
            totalAgents,
            onlineAgents,
            activeWorkspaceIds,
        ] = await Promise.all([
            prisma.workspace.count({ where: { deletedAt: null } }),
            prisma.user.count(),
            prisma.asset.count({ where: { deletedAt: null } }),
            prisma.ticket.count({ where: { status: 'OPEN' } }),
            prisma.agentConnection.count(),
            prisma.agentConnection.count({ where: { status: 'ONLINE' } }),
            prisma.auditLog.findMany({
                where: { createdAt: { gte: since24h } },
                select: { workspaceId: true },
                distinct: ['workspaceId'],
            }),
        ]);

        const result: PlatformKPIs = {
            totalWorkspaces,
            totalUsers,
            activeWorkspaces24h: activeWorkspaceIds.filter((r) => r.workspaceId !== null).length,
            totalAssets,
            openTickets,
            totalAgents,
            onlineAgents,
        };

        dashboardCache.set(cacheKey, result, 60_000);
        return result;
    }

    // =========================================================================
    // WORKSPACE LIST
    // =========================================================================

    static async getWorkspaceList(
        page = 1,
        limit = 20,
        search = ''
    ): Promise<WorkspaceListResult> {
        const skip = (page - 1) * limit;
        const whereClause = search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { slug: { contains: search, mode: 'insensitive' as const } },
                ],
            }
            : {};

        const [rawWorkspaces, total] = await Promise.all([
            prisma.workspace.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    ownerId: true,
                    createdAt: true,
                    owner: { select: { email: true, name: true } },
                    subscription: { select: { plan: true, status: true } },
                    _count: {
                        select: {
                            members: true,
                            assets: true,
                            agentConnections: true,
                        },
                    },
                },
            }),
            prisma.workspace.count({ where: whereClause }),
        ]);

        // Fetch last activity per workspace from audit log
        const workspaceIds = rawWorkspaces.map((w) => w.id);
        const lastActivities = workspaceIds.length > 0
            ? await prisma.auditLog.groupBy({
                by: ['workspaceId'],
                where: { workspaceId: { in: workspaceIds } },
                _max: { createdAt: true },
            })
            : [];

        const activityMap = new Map(
            lastActivities.map((a) => [a.workspaceId, a._max.createdAt])
        );

        const workspaces: WorkspaceRow[] = rawWorkspaces.map((w) => ({
            id: w.id,
            name: w.name,
            slug: w.slug,
            ownerId: w.ownerId,
            ownerName: w.owner?.name ?? null,
            ownerEmail: w.owner?.email ?? null,
            plan: w.subscription?.plan ?? null,
            status: w.subscription?.status ?? null,
            createdAt: w.createdAt,
            userCount: w._count.members,
            assetCount: w._count.assets,
            agentCount: w._count.agentConnections,
            lastActivity: activityMap.get(w.id) ?? null,
        }));

        const cacheKey = `super:ws-list:${page}:${limit}:${search}`;
        const result: WorkspaceListResult = { workspaces, total };
        dashboardCache.set(cacheKey, result, 30_000);
        return result;
    }

    // =========================================================================
    // USAGE ANALYTICS
    // =========================================================================

    static async getUsageAnalytics(days = 30): Promise<UsageAnalytics> {
        const cacheKey = `super:analytics:${days}`;
        const cached = dashboardCache.get<UsageAnalytics>(cacheKey);
        if (cached) return cached;

        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Cross-workspace audit log grouped by day (raw query for DATE_TRUNC)
        type RawDayRow = { workspace_id: string; workspace_name: string; day: Date; events: bigint };
        const rawActivity = await prisma.$queryRaw<RawDayRow[]>`
            SELECT al."workspaceId" as workspace_id,
                   w.name           as workspace_name,
                   DATE_TRUNC('day', al."createdAt") as day,
                   COUNT(*)::bigint   as events
            FROM "AuditLog" al
            LEFT JOIN "Workspace" w ON w.id = al."workspaceId"
            WHERE al."createdAt" > ${since}
              AND al."workspaceId" IS NOT NULL
            GROUP BY al."workspaceId", w.name, DATE_TRUNC('day', al."createdAt")
            ORDER BY day ASC
            LIMIT 2000
        `;

        const activityByDay: DayActivity[] = rawActivity.map((r) => ({
            workspaceId: r.workspace_id,
            workspaceName: r.workspace_name ?? r.workspace_id,
            day: r.day.toISOString().split('T')[0],
            events: Number(r.events),
        }));

        // Per-workspace aggregated usage
        type RawUsageRow = {
            workspace_id: string;
            workspace_name: string;
            asset_count: bigint;
            user_count: bigint;
            agent_count: bigint;
            audit_events: bigint;
            open_tickets: bigint;
        };
        const rawUsage = await prisma.$queryRaw<RawUsageRow[]>`
            SELECT
                w.id                                          AS workspace_id,
                w.name                                        AS workspace_name,
                COUNT(DISTINCT a.id)                          AS asset_count,
                COUNT(DISTINCT m."userId")                    AS user_count,
                COUNT(DISTINCT ac.id)                         AS agent_count,
                COUNT(DISTINCT al.id)                         AS audit_events,
                COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'OPEN') AS open_tickets
            FROM "Workspace" w
            LEFT JOIN "Asset"           a  ON a."workspaceId"  = w.id AND a."deletedAt" IS NULL
            LEFT JOIN "WorkspaceMember" m  ON m."workspaceId"  = w.id
            LEFT JOIN "AgentConnection" ac ON ac."workspaceId" = w.id
            LEFT JOIN "AuditLog"        al ON al."workspaceId" = w.id AND al."createdAt" > ${since}
            LEFT JOIN "Ticket"          t  ON t."workspaceId"  = w.id
            WHERE w."deletedAt" IS NULL
            GROUP BY w.id, w.name
            ORDER BY audit_events DESC
            LIMIT 100
        `;

        const workspaceUsage: WorkspaceUsage[] = rawUsage.map((r) => ({
            workspaceId: r.workspace_id,
            workspaceName: r.workspace_name,
            assetCount: Number(r.asset_count),
            userCount: Number(r.user_count),
            agentCount: Number(r.agent_count),
            auditEvents: Number(r.audit_events),
            openTickets: Number(r.open_tickets),
        }));

        const topByAssets = [...workspaceUsage].sort((a, b) => b.assetCount - a.assetCount).slice(0, 10);
        const topByActivity = [...workspaceUsage].sort((a, b) => b.auditEvents - a.auditEvents).slice(0, 10);

        const result: UsageAnalytics = { activityByDay, workspaceUsage, topByAssets, topByActivity };
        dashboardCache.set(cacheKey, result, 120_000);
        return result;
    }

    // =========================================================================
    // RECENT ACTIVITY FEED
    // =========================================================================

    static async getRecentActivity(limit = 20): Promise<RecentAuditEvent[]> {
        const cacheKey = `super:activity:${limit}`;
        const cached = dashboardCache.get<RecentAuditEvent[]>(cacheKey);
        if (cached) return cached;

        const logs = await prisma.auditLog.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                workspaceId: true,
                userId: true,
                action: true,
                resourceType: true,
                createdAt: true,
                workspace: { select: { name: true } },
                user: { select: { email: true } },
            },
        });

        const result: RecentAuditEvent[] = logs.map((l) => ({
            id: l.id,
            workspaceId: l.workspaceId ?? null,
            workspaceName: l.workspace?.name ?? null,
            userId: l.userId ?? null,
            userEmail: l.user?.email ?? null,
            action: l.action,
            resourceType: l.resourceType ?? null,
            createdAt: l.createdAt,
        }));

        dashboardCache.set(cacheKey, result, 30_000);
        return result;
    }

    static async getAuditLogsPaginated(page = 1, limit = 20) {
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    workspaceId: true,
                    userId: true,
                    action: true,
                    resourceType: true,
                    createdAt: true,
                    workspace: { select: { name: true } },
                    user: { select: { email: true } },
                },
            }),
            prisma.auditLog.count(),
        ]);

        const events: RecentAuditEvent[] = logs.map((l) => ({
            id: l.id,
            workspaceId: l.workspaceId ?? null,
            workspaceName: l.workspace?.name ?? null,
            userId: l.userId ?? null,
            userEmail: l.user?.email ?? null,
            action: l.action,
            resourceType: l.resourceType ?? null,
            createdAt: l.createdAt,
        }));

        return {
            events,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    // =========================================================================
    // PLATFORM ALERTS
    // =========================================================================

    static async getPlatformAlerts(): Promise<PlatformAlert[]> {
        const cacheKey = 'super:alerts';
        const cached = dashboardCache.get<PlatformAlert[]>(cacheKey);
        if (cached) return cached;

        const since1h = new Date(Date.now() - 60 * 60 * 1000);

        // Count audit events per workspace in the last hour
        const hourlyActivity = await prisma.auditLog.groupBy({
            by: ['workspaceId'],
            where: { createdAt: { gte: since1h }, workspaceId: { not: null } },
            _count: { _all: true },
            orderBy: { _count: { workspaceId: 'desc' } },
            take: 20,
        });

        if (hourlyActivity.length === 0) {
            dashboardCache.set(cacheKey, [], 60_000);
            return [];
        }

        const totalHourlyEvents = hourlyActivity.reduce((sum, r) => sum + r._count._all, 0);
        const avgEventsPerWs = totalHourlyEvents / hourlyActivity.length;

        // Fetch workspace names
        const wsIds = hourlyActivity.map((r) => r.workspaceId!).filter(Boolean);
        const workspaces = await prisma.workspace.findMany({
            where: { id: { in: wsIds } },
            select: { id: true, name: true },
        });
        const nameMap = new Map(workspaces.map((w) => [w.id, w.name]));

        const alerts: PlatformAlert[] = [];

        for (const row of hourlyActivity) {
            if (!row.workspaceId) continue;
            const events = row._count._all;
            const ratio = avgEventsPerWs > 0 ? events / avgEventsPerWs : 0;

            if (ratio >= 5) {
                alerts.push({
                    type: 'spike',
                    workspaceId: row.workspaceId,
                    workspaceName: nameMap.get(row.workspaceId) ?? row.workspaceId,
                    message: `${events} events in the last hour — ${ratio.toFixed(1)}× above average`,
                    severity: ratio >= 10 ? 'critical' : 'warning',
                    value: events,
                });
            } else if (events > 500) {
                alerts.push({
                    type: 'high_activity',
                    workspaceId: row.workspaceId,
                    workspaceName: nameMap.get(row.workspaceId) ?? row.workspaceId,
                    message: `High activity: ${events} events in the last hour`,
                    severity: 'warning',
                    value: events,
                });
            }
        }

        dashboardCache.set(cacheKey, alerts, 60_000);
        return alerts;
    }
}
