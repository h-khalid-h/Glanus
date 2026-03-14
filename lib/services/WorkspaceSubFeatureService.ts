import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';


export interface PatchPolicyUpdateInput {
    name?: string;
    targetSoftware?: string;
    actionScriptId?: string;
    isEnabled?: boolean;
}

/**
 * WorkspaceSubFeatureService — Remaining workspace sub-feature operations.
 *
 * Encapsulates:
 *  - Notifications (unified audit + AI insight feed)
 *  - Unified search (assets, agents, AI insights)
 *  - Workspace agents (list + agent detail with metrics)
 *  - Partner management (remove, review, matchmaking assign)
 *  - Workspace export (JSON/CSV scoped)
 *  - Notification webhooks (CRUD)
 *  - Stripe Customer Portal session creation
 *  - Patch policy update/delete
 *
 * Extracted to separate services:
 *  - InvitationService    → invitations lifecycle
 *  - MaintenanceService   → maintenance windows CRUD
 *  - WorkspaceReportService → CSV reports + report schedules
 *  - NetworkService       → network topology + software inventory
 *  - StorageService       → storage upload audit
 */
export class WorkspaceSubFeatureService {

    // ========================================
    // NOTIFICATIONS
    // ========================================

    static async getNotifications(workspaceId: string, limit = 100) {
        const cap = Math.min(200, Math.max(1, limit));

        const [auditLogs, aiInsights] = await Promise.all([
            prisma.auditLog.findMany({
                where: { workspaceId },
                include: {
                    user: { select: { name: true, email: true } },
                    asset: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: cap,
            }),
            prisma.aIInsight.findMany({
                where: { workspaceId },
                include: { asset: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: cap,
            }),
        ]);

        const notifications = [
            ...(auditLogs).map((log) => ({
                id: log.id,
                type: 'AUDIT_LOG' as const,
                title: log.action,
                description: log.resourceType
                    ? `${log.resourceType} ${log.resourceId ? `(${log.resourceId.slice(0, 8)}...)` : ''}`
                    : 'System event',
                severity: 'INFO' as const,
                createdAt: log.createdAt.toISOString(),
                metadata: {
                    actor: log.user?.name || log.user?.email || 'System',
                    assetName: log.asset?.name || null,
                    resourceType: log.resourceType,
                    resourceId: log.resourceId,
                    ...(typeof log.metadata === 'object' && log.metadata ? log.metadata : {}),
                },
            })),
            ...(aiInsights).map((insight) => ({
                id: insight.id,
                type: 'AI_INSIGHT' as const,
                title: insight.title,
                description: insight.description,
                severity: (insight.severity || 'INFO') as 'INFO' | 'WARNING' | 'CRITICAL',
                confidence: insight.confidence,
                createdAt: insight.createdAt.toISOString(),
                metadata: {
                    insightType: insight.type,
                    assetName: insight.asset?.name || null,
                    assetId: insight.assetId,
                    ...(typeof insight.metadata === 'object' && insight.metadata ? insight.metadata : {}),
                },
            })),
        ];

        notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return notifications.slice(0, cap);
    }

    // ========================================
    // SEARCH
    // ========================================

    static async search(workspaceId: string, q: string, limit = 5) {
        const cap = Math.min(10, Math.max(1, limit));

        if (!q || q.trim().length < 2) {
            return { assets: [], agents: [], insights: [] };
        }

        const query = q.trim();

        const [assets, agents, insights] = await Promise.all([
            prisma.asset.findMany({
                where: {
                    workspaceId, deletedAt: null,
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { serialNumber: { contains: query, mode: 'insensitive' } },
                        { location: { contains: query, mode: 'insensitive' } },
                    ],
                },
                select: {
                    id: true, name: true, assetType: true, status: true, serialNumber: true,
                    category: { select: { name: true } },
                },
                take: cap, orderBy: { updatedAt: 'desc' },
            }),
            prisma.agentConnection.findMany({
                where: {
                    workspaceId,
                    OR: [
                        { hostname: { contains: query, mode: 'insensitive' } },
                        { ipAddress: { contains: query, mode: 'insensitive' } },
                        { asset: { name: { contains: query, mode: 'insensitive' } } },
                    ],
                },
                select: {
                    id: true, hostname: true, platform: true, status: true, ipAddress: true,
                    asset: { select: { id: true, name: true } },
                },
                take: cap, orderBy: { lastSeen: 'desc' },
            }),
            prisma.aIInsight.findMany({
                where: {
                    workspaceId,
                    OR: [
                        { title: { contains: query, mode: 'insensitive' } },
                        { description: { contains: query, mode: 'insensitive' } },
                    ],
                },
                select: {
                    id: true, title: true, type: true, severity: true, confidence: true,
                    acknowledged: true, createdAt: true,
                    asset: { select: { id: true, name: true } },
                },
                take: cap, orderBy: { createdAt: 'desc' },
            }),
        ]);

        return { assets, agents, insights };
    }

    // ========================================
    // WORKSPACE AGENTS
    // ========================================

    static async listWorkspaceAgents(workspaceId: string) {
        const [agents, activeVersions] = await Promise.all([
            prisma.agentConnection.findMany({
                where: { workspaceId },
                include: { asset: { select: { id: true, name: true, model: true, serialNumber: true } } },
                orderBy: { lastSeen: 'desc' },
            }),
            prisma.agentVersion.findMany({ where: { status: 'ACTIVE' }, take: 10 }),
        ]);

        const versionByPlatform = new Map(activeVersions.map((v) => [v.platform, v.version]));
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);

        const data = agents.map((agent) => ({
            id: agent.id,
            status: agent.status,
            platform: agent.platform,
            hostname: agent.hostname,
            agentVersion: agent.agentVersion,
            isOutdated: versionByPlatform.has(agent.platform)
                ? agent.agentVersion !== versionByPlatform.get(agent.platform)
                : false,
            ipAddress: agent.ipAddress || null,
            lastSeen: agent.lastSeen,
            cpuUsage: agent.cpuUsage || null,
            ramUsage: agent.ramUsage || null,
            diskUsage: agent.diskUsage || null,
            asset: agent.asset,
        }));

        const onlineAgents = agents.filter((a) => a.status === 'ONLINE' && a.lastSeen > tenMinsAgo);
        const offlineAgents = agents.filter((a) => a.status === 'OFFLINE' || a.lastSeen <= tenMinsAgo);
        const errorAgents = agents.filter((a) => a.status === 'ERROR');

        return {
            agents: data,
            stats: {
                total: agents.length,
                online: onlineAgents.length,
                offline: offlineAgents.length,
                error: errorAgents.length,
            },
        };
    }

    static async getWorkspaceAgent(workspaceId: string, agentId: string) {
        const agent = await prisma.agentConnection.findUnique({
            where: { id: agentId, workspaceId },
            include: {
                asset: {
                    select: {
                        id: true, name: true, assetType: true, status: true,
                        serialNumber: true, manufacturer: true, model: true, location: true,
                    },
                },
                installedSoftware: { orderBy: { name: 'asc' } },
            },
        });
        if (!agent) throw Object.assign(new Error('Agent not found.'), { statusCode: 404 });

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [metricHistory, recentExecutions] = await Promise.all([
            prisma.agentMetric.findMany({
                where: { agentId, timestamp: { gte: twentyFourHoursAgo } },
                select: { id: true, cpuUsage: true, ramUsage: true, diskUsage: true, timestamp: true },
                orderBy: { timestamp: 'asc' },
                take: 288,
            }),
            prisma.scriptExecution.findMany({
                where: { agentId, workspaceId },
                include: { script: { select: { id: true, name: true, language: true } } },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
        ]);

        return { agent, metricHistory, recentExecutions };
    }

    // ========================================
    // WORKSPACE EXPORT
    // ========================================

    static async exportWorkspace(workspaceId: string, userId: string, format: string, scope: string): Promise<Response> {
        const includeAssets = scope === 'all' || scope === 'assets';
        const includeAgents = scope === 'all' || scope === 'agents';
        const includeAlerts = scope === 'all' || scope === 'alerts';
        const includeAudit = scope === 'all' || scope === 'audit';

        const exportData: Record<string, unknown> = {
            exportedAt: new Date().toISOString(), workspaceId, exportedBy: userId, format, scope,
        };

        const queries: Promise<void>[] = [];
        if (includeAssets) queries.push(prisma.asset.findMany({ where: { workspaceId }, include: { category: { select: { name: true, icon: true } }, assignedTo: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } }).then(assets => { exportData.assets = assets; }));
        if (includeAgents) queries.push(prisma.agentConnection.findMany({ where: { workspaceId }, include: { asset: { select: { name: true } } }, orderBy: { lastSeen: 'desc' } }).then(agents => { exportData.agents = agents; }));
        if (includeAlerts) queries.push(prisma.alertRule.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } }).then(alerts => { exportData.alertRules = alerts; }));
        if (includeAudit) queries.push(prisma.auditLog.findMany({ where: { workspaceId }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 1000 }).then(logs => { exportData.auditLogs = logs; }));

        await Promise.all(queries);

        await prisma.auditLog.create({
            data: {
                workspaceId, userId, action: 'workspace.exported',
                resourceType: 'workspace', resourceId: workspaceId,
                details: { format, scope },
            },
        });

        const dateStr = new Date().toISOString().slice(0, 10);

        if (format === 'csv') {
            const assets = (exportData.assets as Array<Record<string, unknown>>) || [];
            const headers = ['id', 'name', 'assetType', 'status', 'manufacturer', 'model', 'serialNumber', 'location', 'category', 'assignedTo', 'createdAt'];
            const csvRows = [headers.join(',')];
            for (const asset of assets) {
                csvRows.push([
                    asset.id,
                    `"${String(asset.name || '').replace(/"/g, '""')}"`,
                    asset.assetType, asset.status,
                    `"${String(asset.manufacturer || '').replace(/"/g, '""')}"`,
                    `"${String(asset.model || '').replace(/"/g, '""')}"`,
                    asset.serialNumber || '',
                    `"${String(asset.location || '').replace(/"/g, '""')}"`,
                    `"${String((asset.category as Record<string, unknown>)?.name || '').replace(/"/g, '""')}"`,
                    `"${String((asset.assignedTo as Record<string, unknown>)?.email || '').replace(/"/g, '""')}"`,
                    asset.createdAt,
                ].join(','));
            }
            return new Response(csvRows.join('\n'), {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="glanus-export-${workspaceId}-${dateStr}.csv"`,
                },
            });
        }

        return new Response(JSON.stringify(exportData, null, 2), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="glanus-export-${workspaceId}-${dateStr}.json"`,
            },
        });
    }

    // ========================================
    // STRIPE CUSTOMER PORTAL
    // ========================================

    static async createCustomerPortalSession(workspaceId: string) {
        const subscription = await prisma.subscription.findUnique({
            where: { workspaceId },
            select: { stripeCustomerId: true },
        });

        if (!subscription?.stripeCustomerId) {
            throw Object.assign(new Error('No billing account found. Please upgrade first.'), { statusCode: 400 });
        }

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: subscription.stripeCustomerId,
            return_url: `${baseUrl}/workspaces/${workspaceId}/billing`,
        });

        return { url: portalSession.url };
    }

    // ========================================
    // PATCH POLICY (extends PatchService)
    // ========================================

    static async updatePatchPolicy(workspaceId: string, patchId: string, data: PatchPolicyUpdateInput) {
        const policy = await prisma.patchPolicy.findUnique({ where: { id: patchId, workspaceId } });
        if (!policy) throw Object.assign(new Error('Patch policy not found'), { statusCode: 404 });

        if (data.actionScriptId) {
            const script = await prisma.script.findUnique({ where: { id: data.actionScriptId, workspaceId } });
            if (!script) throw Object.assign(new Error('Replacement remediation script not found'), { statusCode: 404 });
        }

        return prisma.patchPolicy.update({
            where: { id: patchId },
            data,
            include: { actionScript: { select: { id: true, name: true, language: true } } },
        });
    }

    static async deletePatchPolicy(workspaceId: string, patchId: string) {
        const policy = await prisma.patchPolicy.findUnique({ where: { id: patchId, workspaceId } });
        if (!policy) throw Object.assign(new Error('Patch policy not found'), { statusCode: 404 });
        await prisma.patchPolicy.delete({ where: { id: patchId } });
        return { deleted: true };
    }
}
