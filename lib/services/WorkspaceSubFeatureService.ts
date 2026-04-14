import { ApiError } from '@/lib/errors';
/**
 * WorkspaceSubFeatureService — Workspace-level utility operations.
 *
 * Responsibilities:
 *  - exportWorkspace: streamed JSON/CSV export of all workspace data
 *  - createCustomerPortalSession: Stripe billing portal redirect
 *
 * Other workspace concerns have been extracted to dedicated services:
 *  - WorkspaceAgentService    → agent list + agent detail
 *  - WorkspaceSearchService   → unified cross-entity search
 *  - WorkspaceNotificationService → unified notification feed
 *  - PatchService             → patch policy CRUD (including update/delete)
 */
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';

export class WorkspaceSubFeatureService {

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
        const EXPORT_LIMIT = 5000;
        if (includeAssets) queries.push(prisma.asset.findMany({ where: { workspaceId, deletedAt: null }, include: { category: { select: { name: true, icon: true } }, assignedTo: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: EXPORT_LIMIT }).then(assets => { exportData.assets = assets; }));
        if (includeAgents) queries.push(prisma.agentConnection.findMany({ where: { workspaceId }, include: { asset: { select: { name: true } } }, orderBy: { lastSeen: 'desc' }, take: EXPORT_LIMIT }).then(agents => { exportData.agents = agents; }));
        if (includeAlerts) queries.push(prisma.alertRule.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: EXPORT_LIMIT }).then(alerts => { exportData.alertRules = alerts; }));
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
                    `"${String(asset.serialNumber || '').replace(/"/g, '""')}"`,
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
            throw new ApiError(400, 'No billing account found. Please upgrade first.');
        }

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        try {
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: subscription.stripeCustomerId,
                return_url: `${baseUrl}/workspaces/${workspaceId}/manage/settings`,
            });
            return { url: portalSession.url };
        } catch (error: unknown) {
            if (error instanceof Error && (error.message?.includes('Invalid API Key') || String(process.env.STRIPE_SECRET_KEY).includes('sk_test_...'))) {
                throw new ApiError(400, 'Customer Portal is not configured: Please provide a valid Stripe Secret Key in your environment variables.');
            }
            throw new ApiError(500, error instanceof Error ? error.message : 'Failed to create customer portal session');
        }
    }
}
