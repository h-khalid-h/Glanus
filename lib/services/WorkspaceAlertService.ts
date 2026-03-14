/**
 * WorkspaceAlertService — Manages alert rules and their webhook delivery configuration.
 *
 * Responsibilities:
 *  - listAlertRules: fetch all alert rules for a workspace
 *  - createAlertRule / updateAlertRule / deleteAlertRule: CRUD for alert configurations
 *  - listAlerts / acknowledgeAlert / resolveAlert: active alert lifecycle
 */
import { prisma } from '@/lib/db';

// ============================================
// INPUT TYPES
// ============================================

export interface AlertRuleInput {
    name: string;
    metric: 'CPU' | 'RAM' | 'DISK' | 'OFFLINE';
    threshold: number;
    duration: number;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    notifyEmail?: boolean;
    notifyWebhook?: boolean;
}

export interface UpdateAlertRuleInput {
    name?: string;
    metric?: 'CPU' | 'RAM' | 'DISK' | 'OFFLINE';
    threshold?: number;
    duration?: number;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    enabled?: boolean;
    notifyEmail?: boolean;
    notifyWebhook?: boolean;
}

export interface WebhookInput {
    url: string;
    secret?: string;
    enabled: boolean;
}

// ============================================
// WORKSPACE ALERT SERVICE
// ============================================

/**
 * WorkspaceAlertService — Domain layer for workspace-scoped alert rules
 * and notification webhook management.
 *
 * This complements the global AlertService (alert evaluation / oracle matrix)
 * with CRUD operations scoped to a specific workspace.
 */
export class WorkspaceAlertService {

    // ========================================
    // ALERT RULES
    // ========================================

    static async listAlertRules(workspaceId: string) {
        return prisma.alertRule.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
        });
    }

    static async createAlertRule(workspaceId: string, userId: string, data: AlertRuleInput) {
        const alertRule = await prisma.alertRule.create({
            data: { ...data, workspaceId, createdBy: userId, enabled: true },
        });
        await prisma.auditLog.create({
            data: {
                action: 'ALERT_RULE_CREATED',
                resourceType: 'AlertRule',
                resourceId: alertRule.id,
                userId,
                metadata: { ruleName: alertRule.name, metric: alertRule.metric, threshold: alertRule.threshold },
            },
        });
        return alertRule;
    }

    static async getAlertRule(workspaceId: string, ruleId: string) {
        const rule = await prisma.alertRule.findFirst({ where: { id: ruleId, workspaceId } });
        if (!rule) throw Object.assign(new Error('Alert rule not found'), { statusCode: 404 });
        return rule;
    }

    static async updateAlertRule(workspaceId: string, ruleId: string, userId: string, data: UpdateAlertRuleInput) {
        const existing = await prisma.alertRule.findFirst({ where: { id: ruleId, workspaceId } });
        if (!existing) throw Object.assign(new Error('Alert rule not found'), { statusCode: 404 });

        const updated = await prisma.alertRule.update({ where: { id: ruleId }, data });
        await prisma.auditLog.create({
            data: {
                action: 'ALERT_RULE_UPDATED',
                resourceType: 'AlertRule',
                resourceId: ruleId,
                userId,
                metadata: { ruleName: updated.name, changes: data },
            },
        });
        return updated;
    }

    static async deleteAlertRule(workspaceId: string, ruleId: string, userId: string) {
        const existing = await prisma.alertRule.findFirst({ where: { id: ruleId, workspaceId } });
        if (!existing) throw Object.assign(new Error('Alert rule not found'), { statusCode: 404 });

        await prisma.alertRule.delete({ where: { id: ruleId } });
        await prisma.auditLog.create({
            data: {
                action: 'ALERT_RULE_DELETED',
                resourceType: 'AlertRule',
                resourceId: ruleId,
                userId,
                metadata: { ruleName: existing.name },
            },
        });
    }

    // ========================================
    // NOTIFICATION WEBHOOKS
    // ========================================

    /** Webhook select shape (never exposes secret). */
    private static readonly WEBHOOK_SELECT = {
        id: true, url: true, enabled: true,
        lastSuccess: true, lastFailure: true, failureCount: true,
        createdAt: true, updatedAt: true,
    } as const;

    static async listWebhooks(workspaceId: string) {
        return prisma.notificationWebhook.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            select: WorkspaceAlertService.WEBHOOK_SELECT,
        });
    }

    /**
     * Upsert a webhook for the workspace (only one per workspace is supported).
     */
    static async upsertWebhook(workspaceId: string, userId: string, data: WebhookInput) {
        const existing = await prisma.notificationWebhook.findFirst({ where: { workspaceId } });

        const webhook = existing
            ? await prisma.notificationWebhook.update({
                where: { id: existing.id },
                data: { url: data.url, secret: data.secret, enabled: data.enabled },
                select: WorkspaceAlertService.WEBHOOK_SELECT,
            })
            : await prisma.notificationWebhook.create({
                data: { ...data, workspaceId },
                select: WorkspaceAlertService.WEBHOOK_SELECT,
            });

        await prisma.auditLog.create({
            data: {
                workspaceId,
                userId,
                action: existing ? 'webhook.updated' : 'webhook.created',
                resourceType: 'NotificationWebhook',
                resourceId: webhook.id,
                metadata: { url: webhook.url },
            },
        });

        return { webhook, created: !existing };
    }

    static async deleteWebhook(workspaceId: string, webhookId: string, userId: string) {
        const target = await prisma.notificationWebhook.findFirst({ where: { id: webhookId, workspaceId } });
        if (!target) throw Object.assign(new Error('Webhook not found'), { statusCode: 404 });

        await prisma.notificationWebhook.delete({ where: { id: webhookId } });
        await prisma.auditLog.create({
            data: {
                workspaceId,
                userId,
                action: 'webhook.deleted',
                resourceType: 'NotificationWebhook',
                resourceId: webhookId,
                metadata: { url: target.url },
            },
        });
    }
}
