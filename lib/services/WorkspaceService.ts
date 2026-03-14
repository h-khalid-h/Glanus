/**
 * WorkspaceService — Core workspace lifecycle and activity feed.
 *
 * Responsibilities:
 *  - listWorkspaces / getWorkspace / updateWorkspace / deleteWorkspace: workspace CRUD with audit logging
 *  - createWorkspace: provision workspace, subscription, OWNER membership, and optional sample data
 *  - getActivity: unified activity feed (audit logs + alerts + agent events + AI insights)
 *
 * Extracted to sibling service:
 *  - WorkspaceMemberService → listMembers / updateMemberRole / removeMember
 */
import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';
import { auditLog } from '@/lib/workspace/auditLog';
import { sendEmail } from '@/lib/email/sendgrid';
import { getRoleChangedEmailTemplate, getMemberRemovedEmailTemplate } from '@/lib/email/templates';
import { sanitizeText } from '@/lib/security/sanitize';
import { createSampleWorkspaceData } from '@/lib/seed/sampleWorkspaceData';

// ============================================
// INPUT TYPES
// ============================================

export interface UpdateWorkspaceInput {
    name?: string;
    description?: string;
    logo?: string | null;
    primaryColor?: string;
    accentColor?: string;
}

export interface CreateWorkspaceInput {
    name: string;
    slug: string;
    description?: string;
    primaryColor?: string;
    accentColor?: string;
    plan: 'FREE' | 'PERSONAL' | 'TEAM' | 'ENTERPRISE';
    createSampleData?: boolean;
}


export interface ActivityFilters {
    limit?: number;
    cursor?: string;
    types?: string | null;
}

export interface ActivityItem {
    id: string;
    type: 'audit' | 'alert' | 'agent' | 'insight';
    title: string;
    description: string;
    severity?: string;
    actor?: { name: string | null; email: string } | null;
    resource?: { type: string; id: string; name?: string | null } | null;
    timestamp: string;
}

const PLAN_LIMITS = {
    FREE: { maxAssets: 5, maxAICreditsPerMonth: 100, maxStorageMB: 1024 },
    PERSONAL: { maxAssets: 50, maxAICreditsPerMonth: 1000, maxStorageMB: 10240 },
    TEAM: { maxAssets: 200, maxAICreditsPerMonth: 5000, maxStorageMB: 51200 },
    ENTERPRISE: { maxAssets: 999999, maxAICreditsPerMonth: 999999, maxStorageMB: 999999 },
} as const;

// ============================================
// WORKSPACE SERVICE
// ============================================

/**
 * WorkspaceService — Domain layer for core workspace lifecycle operations.
 *
 * Encapsulates:
 *   - Workspace list/create/CRUD (get, update, delete) with audit logging
 *   - Member management (list, update role, remove) with email notifications
 *   - Unified activity feed (audit logs + alerts + agent events + AI insights)
 */
export class WorkspaceService {

    // ========================================
    // WORKSPACE LIST / CREATE
    // ========================================

    /**
     * List all workspaces for a user (owned + member), with plan and member counts.
     */
    static async listWorkspaces(userId: string) {
        const workspaces = await prisma.workspace.findMany({
            where: {
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId } } },
                ],
            },
            include: {
                subscription: {
                    select: { plan: true, status: true, maxAssets: true, aiCreditsUsed: true, maxAICreditsPerMonth: true },
                },
                members: { select: { id: true, role: true } },
                _count: { select: { assets: true, members: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return workspaces.map((workspace) => {
            const membership = workspace.members.find((m) => m.id === userId);
            const isOwner = workspace.ownerId === userId;
            return { ...workspace, userRole: isOwner ? 'OWNER' : (membership?.role || 'VIEWER') };
        });
    }

    /**
     * Create a new workspace with subscription, OWNER membership, and optional sample data.
     * Slug uniqueness must be pre-verified by the caller.
     */
    static async createWorkspace(userId: string, data: CreateWorkspaceInput) {
        const sanitizedName = sanitizeText(data.name);
        const sanitizedDescription = data.description ? sanitizeText(data.description) : null;
        const planLimits = PLAN_LIMITS[data.plan] ?? PLAN_LIMITS.FREE;

        // Slug uniqueness — fast-fail before starting the transaction
        const existingSlug = await prisma.workspace.findUnique({ where: { slug: data.slug } });
        if (existingSlug) throw Object.assign(new Error('Workspace slug already taken'), { statusCode: 409 });

        const workspace = await prisma.$transaction(async (tx) => {
            const newWorkspace = await tx.workspace.create({
                data: {
                    name: sanitizedName,
                    slug: data.slug,
                    description: sanitizedDescription,
                    primaryColor: data.primaryColor || '#3B82F6',
                    accentColor: data.accentColor || '#10B981',
                    ownerId: userId,
                },
            });

            await tx.subscription.create({
                data: { workspaceId: newWorkspace.id, plan: data.plan, status: 'ACTIVE', ...planLimits },
            });

            await tx.workspaceMember.create({
                data: { workspaceId: newWorkspace.id, userId, role: 'OWNER' },
            });

            return newWorkspace;
        });

        // Create sample data if requested (non-blocking)
        if (data.createSampleData) {
            createSampleWorkspaceData(prisma, { workspaceId: workspace.id, userId })
                .catch((err: unknown) => logError('Failed to create sample data', err));
        }

        return prisma.workspace.findUnique({
            where: { id: workspace.id },
            include: { subscription: true, _count: { select: { assets: true, members: true } } },
        });
    }

    // ========================================
    // WORKSPACE CRUD
    // ========================================

    /**
     * Fetch full workspace details including subscription, members, and counts.
     */
    static async getWorkspace(workspaceId: string) {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: {
                subscription: true,
                owner: { select: { id: true, name: true, email: true } },
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
                _count: { select: { assets: true, members: true, invitations: true } },
            },
        });
        if (!workspace) {
            throw Object.assign(new Error('Workspace not found'), { statusCode: 404 });
        }
        return workspace;
    }

    /**
     * Update workspace metadata. Creates an audit log entry on success.
     */
    static async updateWorkspace(workspaceId: string, userId: string, data: UpdateWorkspaceInput) {
        const updated = await prisma.workspace.update({
            where: { id: workspaceId },
            data,
            include: {
                subscription: true,
                _count: { select: { assets: true, members: true } },
            },
        });

        await prisma.auditLog.create({
            data: {
                action: 'WORKSPACE_UPDATED',
                resourceType: 'Workspace',
                resourceId: workspaceId,
                userId,
                metadata: { workspaceName: updated.name, changes: data },
            },
        });

        return updated;
    }

    /**
     * Delete a workspace. Pre-logs the deletion audit entry before cascade-delete
     * to prevent integrity issues from the cascade wiping the audit log table relations.
     */
    static async deleteWorkspace(workspaceId: string, userId: string) {
        // Log BEFORE cascade-delete to avoid FK integrity failures
        await prisma.auditLog.create({
            data: {
                action: 'WORKSPACE_DELETED',
                resourceType: 'Workspace',
                resourceId: workspaceId,
                userId,
                metadata: { deletedAt: new Date().toISOString() },
            },
        });

        await prisma.workspace.delete({ where: { id: workspaceId } });
    }
    // ========================================
    // ACTIVITY FEED
    // ========================================

    /**
     * Unified workspace activity feed.
     * Merges audit logs, alert rules, agent events, and AI insights in parallel,
     * then sorts by timestamp and paginates.
     */
    static async getActivity(workspaceId: string, filters: ActivityFilters) {
        const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
        const enabledTypes = new Set(
            filters.types ? filters.types.split(',') : ['audit', 'alert', 'agent', 'insight'],
        );
        const cursorDate = filters.cursor ? new Date(filters.cursor) : undefined;
        const items: ActivityItem[] = [];
        const queries: Promise<void>[] = [];

        if (enabledTypes.has('audit')) {
            queries.push(
                prisma.auditLog.findMany({
                    where: { workspaceId, ...(cursorDate && { createdAt: { lt: cursorDate } }) },
                    include: { user: { select: { name: true, email: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                }).then(logs => {
                    for (const log of logs) {
                        items.push({
                            id: `audit-${log.id}`,
                            type: 'audit',
                            title: WorkspaceService.formatAuditAction(log.action),
                            description: log.resourceType
                                ? `${log.resourceType} • ${log.resourceId || 'N/A'}`
                                : log.action,
                            actor: log.user,
                            resource: log.resourceType
                                ? { type: log.resourceType, id: log.resourceId || '' }
                                : undefined,
                            timestamp: log.createdAt.toISOString(),
                        });
                    }
                }),
            );
        }

        if (enabledTypes.has('alert')) {
            queries.push(
                prisma.alertRule.findMany({
                    where: { workspaceId, ...(cursorDate && { updatedAt: { lt: cursorDate } }) },
                    select: { id: true, name: true, severity: true, metric: true, enabled: true, threshold: true, updatedAt: true },
                    orderBy: { updatedAt: 'desc' },
                    take: limit,
                }).then(alerts => {
                    for (const a of alerts) {
                        items.push({
                            id: `alert-${a.id}`,
                            type: 'alert',
                            title: `Alert: ${a.name}`,
                            description: `${a.metric} > ${a.threshold} • Severity: ${a.severity} • ${a.enabled ? 'Enabled' : 'Disabled'}`,
                            severity: a.severity,
                            timestamp: a.updatedAt.toISOString(),
                        });
                    }
                }),
            );
        }

        if (enabledTypes.has('agent')) {
            queries.push(
                prisma.agentConnection.findMany({
                    where: { workspaceId, ...(cursorDate && { lastSeen: { lt: cursorDate } }) },
                    select: {
                        id: true, hostname: true, status: true, platform: true,
                        ipAddress: true, lastSeen: true,
                        asset: { select: { id: true, name: true } },
                    },
                    orderBy: { lastSeen: 'desc' },
                    take: limit,
                }).then(agents => {
                    for (const agent of agents) {
                        items.push({
                            id: `agent-${agent.id}`,
                            type: 'agent',
                            title: `Agent: ${agent.hostname}`,
                            description: `${agent.platform} • ${agent.status} • ${agent.ipAddress || 'No IP'}`,
                            severity: agent.status === 'OFFLINE' ? 'warning' : undefined,
                            resource: agent.asset
                                ? { type: 'asset', id: agent.asset.id, name: agent.asset.name }
                                : undefined,
                            timestamp: agent.lastSeen.toISOString(),
                        });
                    }
                }),
            );
        }

        if (enabledTypes.has('insight')) {
            queries.push(
                prisma.aIInsight.findMany({
                    where: { workspaceId, ...(cursorDate && { createdAt: { lt: cursorDate } }) },
                    select: {
                        id: true, title: true, type: true, severity: true,
                        confidence: true, acknowledged: true, createdAt: true,
                        asset: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                }).then(insights => {
                    for (const ins of insights) {
                        items.push({
                            id: `insight-${ins.id}`,
                            type: 'insight',
                            title: ins.title,
                            description: `${ins.type} • ${ins.severity || 'info'} • ${ins.acknowledged ? 'Acknowledged' : 'Unacknowledged'}`,
                            severity: ins.severity || undefined,
                            resource: ins.asset
                                ? { type: 'asset', id: ins.asset.id, name: ins.asset.name }
                                : undefined,
                            timestamp: ins.createdAt.toISOString(),
                        });
                    }
                }),
            );
        }

        await Promise.all(queries);

        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const page = items.slice(0, limit);

        return {
            items: page,
            nextCursor: page.length > 0 ? page[page.length - 1].timestamp : null,
            hasMore: items.length > limit,
        };
    }

    private static formatAuditAction(action: string): string {
        const parts = action.split('.');
        const resource = parts[0]?.replace(/_/g, ' ') || '';
        const verb = parts[1]?.replace(/_/g, ' ') || action;
        return `${resource.charAt(0).toUpperCase() + resource.slice(1)} ${verb}`;
    }

}
