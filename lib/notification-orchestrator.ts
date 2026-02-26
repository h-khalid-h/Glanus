// Notification Orchestrator - coordinates alert evaluation and delivery
import { alertEvaluator } from './alert-evaluator';
import { webhookService } from './webhook-service';
import { emailService } from './email-service';
import { prisma } from './db';

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

        const results: NotificationResult[] = [];

        for (const workspace of workspaces) {
            const result = await this.processWorkspace(workspace.id);
            results.push(result);
        }

        return results;
    }
}

export const notificationOrchestrator = new NotificationOrchestrator();
