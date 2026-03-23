import { ApiError } from '@/lib/errors';
/**
 * WorkspaceAuditService — Manages the workspace audit log for compliance and traceability.
 *
 * Responsibilities:
 *  - getAuditLogs: paginated audit log with actor/action/date filters
 *  - exportAuditLogs: CSV export of filtered audit entries
 *  - verifyAdminAccess: validate caller has ADMIN or OWNER role
 */
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ============================================
// INPUT TYPES
// ============================================

export interface AuditLogFilters {
    page?: number;
    limit?: number;
    userId?: string | null;
    action?: string | null;
    resourceType?: string | null;
    assetId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
}

export interface AuditExportFilters {
    format?: string | null;
    action?: string | null;
    resourceType?: string | null;
    startDate?: string | null;
    endDate?: string | null;
}

// ============================================
// WORKSPACE AUDIT SERVICE
// ============================================

/**
 * WorkspaceAuditService — Domain layer for workspace audit log querying
 * and export operations.
 *
 * Access is always gated behind `manageSettings` permission.
 */
export class WorkspaceAuditService {

    private static buildWhere(workspaceId: string, filters: AuditLogFilters | AuditExportFilters): Prisma.AuditLogWhereInput {
        const where: Prisma.AuditLogWhereInput = { workspaceId };

        if ('userId' in filters && filters.userId) where.userId = filters.userId;
        if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
        if (filters.resourceType) where.resourceType = filters.resourceType;
        if ('assetId' in filters && filters.assetId) where.assetId = filters.assetId;

        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                (where.createdAt as Prisma.DateTimeFilter).gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                (where.createdAt as Prisma.DateTimeFilter).lte = end;
            }
        }

        return where;
    }

    /**
     * Verify the caller has admin/owner-level access (ADMIN or OWNER role).
     * Throws a structured error if denied.
     */
    static async verifyAdminAccess(userId: string, workspaceId: string) {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { ownerId: true },
        });
        if (!workspace) throw new ApiError(404, 'Workspace not found');

        const isOwner = workspace.ownerId === userId;
        if (!isOwner) {
            const membership = await prisma.workspaceMember.findUnique({
                where: { workspaceId_userId: { workspaceId, userId } },
                select: { role: true },
            });
            if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
                throw new ApiError(403, 'Must be an admin or owner to view audit logs');
            }
        }
    }

    /**
     * Paginated audit log query with multi-field filtering.
     */
    static async getLogs(workspaceId: string, filters: AuditLogFilters) {
        const page = Math.max(1, filters.page ?? 1);
        const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
        const skip = (page - 1) * limit;
        const where = WorkspaceAuditService.buildWhere(workspaceId, filters);

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    asset: { select: { id: true, name: true } },
                },
            }),
            prisma.auditLog.count({ where }),
        ]);

        return { logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    /**
     * Export audit logs as CSV or JSON.
     * Capped at 10,000 rows for safety.
     */
    static async exportLogs(workspaceId: string, filters: AuditExportFilters) {
        const where = WorkspaceAuditService.buildWhere(workspaceId, filters);
        const logs = await prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 10000,
            include: {
                user: { select: { name: true, email: true } },
                asset: { select: { name: true } },
            },
        });

        const dateStr = new Date().toISOString().split('T')[0];
        const slug = workspaceId.slice(0, 8);

        if (filters.format === 'json') {
            return {
                format: 'json' as const,
                filename: `audit-logs-${slug}-${dateStr}.json`,
                content: JSON.stringify(logs, null, 2),
            };
        }

        // CSV
        const escape = (val: string | null | undefined) => {
            if (val == null) return '';
            const s = String(val).replace(/"/g, '""');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
        };
        const header = 'Timestamp,Action,Actor Name,Actor Email,Resource Type,Resource ID,Asset,IP Address,Details\n';
        const rows = logs.map(log => [
            new Date(log.createdAt).toISOString(),
            escape(log.action),
            escape(log.user?.name),
            escape(log.user?.email),
            escape(log.resourceType),
            escape(log.resourceId),
            escape(log.asset?.name),
            escape(log.ipAddress),
            escape(log.details ? JSON.stringify(log.details) : ''),
        ].join(','));

        return {
            format: 'csv' as const,
            filename: `audit-logs-${slug}-${dateStr}.csv`,
            content: header + rows.join('\n'),
        };
    }

    /**
     * Alert stats for cron/process-alerts status endpoint.
     */
    static async getStats() {
        const [totalRules, enabledRules, workspacesWithAlerts, totalWebhooks] = await Promise.all([
            prisma.alertRule.count(),
            prisma.alertRule.count({ where: { enabled: true } }),
            prisma.workspace.count({ where: { alertRules: { some: { enabled: true } } } }),
            prisma.notificationWebhook.count({ where: { enabled: true } }),
        ]);
        return { totalRules, enabledRules, workspacesWithAlerts, totalWebhooks };
    }
}
