/**
 * Workspace Audit Logger
 * 
 * Records workspace-level activity for compliance and security auditing.
 * Tracks who did what, when, and on which resource.
 */

import { prisma } from '@/lib/db';
import { logInfo } from '@/lib/logger';

export type AuditAction =
    | 'workspace.created'
    | 'workspace.updated'
    | 'workspace.deleted'
    // ── Invitation lifecycle ──
    | 'invitation.sent'
    | 'invitation.resent'
    | 'invitation.cancelled'
    | 'invitation.accepted'
    // ── Member lifecycle ──
    | 'member.invited'
    | 'member.added'
    | 'member.removed'
    | 'member.updated'
    | 'member.role_changed'
    | 'member.password_reset'
    // ── User lifecycle ──
    | 'user.created'
    | 'asset.created'
    | 'asset.updated'
    | 'asset.deleted'
    | 'subscription.created'
    | 'subscription.updated'
    | 'subscription.canceled'
    | 'settings.updated'
    | 'agent.deployed'
    | 'agent.removed'
    | 'script.executed'
    | 'alert.created'
    | 'alert.triggered'
    | 'api_key.created'
    | 'api_key.revoked'
    | 'automation.created'
    | 'automation.deleted';

interface AuditLogEntry {
    workspaceId: string;
    userId: string;
    action: AuditAction;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Record an audit log entry for a workspace action.
 * Non-blocking — errors are logged but don't affect the main operation.
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                workspaceId: entry.workspaceId,
                userId: entry.userId,
                action: entry.action,
                resourceType: entry.resourceType || null,
                resourceId: entry.resourceId || null,
                details: entry.details || {},
                ipAddress: entry.ipAddress || null,
                userAgent: entry.userAgent || null,
                createdAt: new Date(),
            },
        });

        logInfo(`[AUDIT] ${entry.action}`, {
            workspaceId: entry.workspaceId,
            userId: entry.userId,
            resourceType: entry.resourceType,
            resourceId: entry.resourceId,
        });
    } catch (error: unknown) {
        // Never fail the main operation due to audit logging
        logInfo('[AUDIT] Failed to write audit log (table may not exist yet)', {
            action: entry.action,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

/**
 * Query audit logs for a workspace.
 */
export async function getAuditLogs(
    workspaceId: string,
    options: {
        page?: number;
        pageSize?: number;
        action?: AuditAction;
        userId?: string;
        startDate?: Date;
        endDate?: Date;
    } = {}
) {
    const {
        page = 1,
        pageSize = 50,
        action,
        userId,
        startDate,
        endDate,
    } = options;

    const where: Record<string, unknown> = {
        workspaceId,
        ...(action && { action }),
        ...(userId && { userId }),
        ...(startDate || endDate
            ? {
                createdAt: {
                    ...(startDate && { gte: startDate }),
                    ...(endDate && { lte: endDate }),
                },
            }
            : {}),
    };

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        }),
        prisma.auditLog.count({ where }),
    ]);

    return {
        logs,
        pagination: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        },
    };
}
