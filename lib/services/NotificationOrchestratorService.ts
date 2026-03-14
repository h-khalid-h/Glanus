/**
 * NotificationOrchestratorService — Coordinates alert evaluation and multi-channel delivery.
 *
 * Responsibilities:
 *  - run: evaluate all workspaces for triggered alerts and dispatch via webhook + email
 *  - Delegates evaluation to AlertEvaluator and delivery to WebhookService / EmailService
 */
import { alertEvaluator } from '@/lib/services/AlertEvaluatorService';
import { webhookService } from '@/lib/services/WebhookNotificationService';
import { emailService } from '@/lib/services/AlertEmailService';
import { fireWebhookAsync, WebhookEvents } from '@/lib/notifications/webhook-delivery';
import { prisma } from '@/lib/db';

interface NotificationResult {
    workspaceId: string;
    alertsTriggered: number;
    emailsSent: number;
    webhooksSent: number;
    errors: string[];
}

export class NotificationOrchestrator {
    /**
     * Process alerts for a single workspace
     */
    async processWorkspace(workspaceId: string): Promise<NotificationResult> {
        const result: NotificationResult = {
            workspaceId,
            alertsTriggered: 0,
            emailsSent: 0,
            webhooksSent: 0,
            errors: [],
        };

        try {
            // Evaluate all alert rules
            const triggers = await alertEvaluator.evaluateWorkspace(workspaceId);
            result.alertsTriggered = triggers.length;

            if (triggers.length === 0) {
                return result;
            }

            // Get alert rules and webhook config
            const [rules, webhook] = await Promise.all([
                prisma.alertRule.findMany({
                    where: {
                        workspaceId,
                        enabled: true,
                    },
                }),
                prisma.notificationWebhook.findFirst({
                    where: {
                        workspaceId,
                        enabled: true,
                    },
                }),
            ]);

            // Group triggers by rule
            const triggersByRule = new Map<string, typeof triggers>();
            for (const trigger of triggers) {
                if (!triggersByRule.has(trigger.ruleId)) {
                    triggersByRule.set(trigger.ruleId, []);
                }
                triggersByRule.get(trigger.ruleId)!.push(trigger);
            }

            // Send notifications for each triggered rule
            for (const [ruleId, ruleTriggers] of triggersByRule) {
                const rule = rules.find((r) => r.id === ruleId);
                if (!rule) continue;

                // Send email notifications
                if (rule.notifyEmail) {
                    try {
                        const emails = await emailService.getWorkspaceAdminEmails(workspaceId);

                        for (const trigger of ruleTriggers) {
                            const emailResult = await emailService.sendAlert({
                                to: emails,
                                subject: `${trigger.severity} Alert: ${trigger.ruleName}`,
                                alert: trigger.ruleName,
                                asset: trigger.assetName,
                                metric: trigger.metric,
                                value: trigger.currentValue,
                                threshold: trigger.threshold,
                                severity: trigger.severity,
                                timestamp: new Date().toISOString(),
                            });

                            if (emailResult.success) {
                                result.emailsSent++;
                            } else {
                                result.errors.push(`Email failed: ${emailResult.error}`);
                            }
                        }
                    } catch (error: unknown) {
                        result.errors.push(`Email error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                // Send webhook notifications
                if (rule.notifyWebhook && webhook) {
                    try {
                        for (const trigger of ruleTriggers) {
                            const webhookResult = await webhookService.send(
                                webhook.url,
                                {
                                    alert: trigger.ruleName,
                                    asset: trigger.assetName,
                                    assetId: trigger.assetId,
                                    metric: trigger.metric,
                                    value: trigger.currentValue,
                                    threshold: trigger.threshold,
                                    severity: trigger.severity,
                                    timestamp: new Date().toISOString(),
                                    workspaceId,
                                },
                                webhook.secret || undefined
                            );

                            await webhookService.updateWebhookStats(webhook.id, webhookResult.success);

                            if (webhookResult.success) {
                                result.webhooksSent++;
                            } else {
                                result.errors.push(`Webhook failed: ${webhookResult.error}`);
                            }

                            // Also fire structured event through the audit-logged delivery pipeline
                            const { eventType, data } = WebhookEvents.alertTriggered(
                                { id: rule.id, name: rule.name, metric: trigger.metric, threshold: trigger.threshold },
                                { hostname: trigger.assetName, currentValue: trigger.currentValue }
                            );
                            fireWebhookAsync(workspaceId, eventType, data);
                        }
                    } catch (error: unknown) {
                        result.errors.push(`Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            }

            return result;
        } catch (error: unknown) {
            result.errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return result;
        }
    }

    /**
     * Process alerts for all workspaces
     */
    async processAll(): Promise<NotificationResult[]> {
        // Get all workspaces with enabled alert rules
        const workspaces = await prisma.workspace.findMany({
            where: {
                alertRules: {
                    some: {
                        enabled: true,
                    },
                },
            },
            select: {
                id: true,
            },
        });

        // Process workspaces concurrently (bounded by Promise.allSettled)
        const settled = await Promise.allSettled(
            workspaces.map(w => this.processWorkspace(w.id))
        );

        return settled.map((result, i) =>
            result.status === 'fulfilled'
                ? result.value
                : {
                    workspaceId: workspaces[i].id,
                    alertsTriggered: 0,
                    emailsSent: 0,
                    webhooksSent: 0,
                    errors: [result.reason?.message || 'Unknown error'],
                }
        );
    }
}

export const notificationOrchestrator = new NotificationOrchestrator();
