/**
 * REFLEX — Automation Engine
 * 
 * Autonomous action engine with a trust-based autonomy spectrum.
 * Every action passes through a consequence model before execution.
 * 
 * Autonomy Levels:
 *   SUGGEST  — Surface recommendation, human decides
 *   CONFIRM  — Queue action, require human approval
 *   AUTO     — Execute automatically with audit trail
 */

import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';
import { fireWebhookAsync, WebhookEvents } from '@/lib/notifications/webhook-delivery';
import type { Recommendation } from '@/lib/cortex/reasoning';

// ─── Types ───────────────────────────────────────────────

export type AutonomyLevel = 'suggest' | 'confirm' | 'auto';

export interface AutomationRule {
    id: string;
    name: string;
    description: string;
    trigger: AutomationTrigger;
    action: AutomationAction;
    autonomyLevel: AutonomyLevel;
    enabled: boolean;
    cooldownMinutes: number;
    lastTriggeredAt?: Date;
    createdBy: string;
    workspaceId: string;
}

export interface AutomationTrigger {
    type: 'metric_threshold' | 'alert_fired' | 'pattern_detected' | 'schedule';
    metric?: 'cpu' | 'ram' | 'disk';
    operator?: 'gt' | 'lt' | 'eq';
    value?: number;
    alertSeverity?: string;
    cronExpression?: string;
}

export interface AutomationAction {
    type: 'run_script' | 'send_notification' | 'restart_agent' | 'create_alert';
    scriptId?: string;
    scriptName?: string;
    notificationChannel?: string;
    message?: string;
    targetAssetId?: string;
}

export interface ConsequenceAssessment {
    riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'dangerous';
    estimatedImpact: string;
    affectedAssets: number;
    reversible: boolean;
    requiresApproval: boolean;
    reasoning: string;
}

export interface ActionQueueItem {
    id: string;
    rule: AutomationRule;
    consequence: ConsequenceAssessment;
    status: 'pending' | 'approved' | 'executing' | 'completed' | 'rejected' | 'failed';
    triggeredAt: Date;
    executedAt?: Date;
    result?: string;
}

// ─── Persistent Rule Store ───────────────────────────────
// Rules are persisted to Workspace.settings.reflexRules as JSON.
// Action queue is persisted to the ActionQueueItem database table.

/**
 * Load rules from database (Workspace.settings.reflexRules)
 */
async function loadRulesFromDB(workspaceId: string): Promise<AutomationRule[]> {
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { settings: true },
    });

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    return (settings.reflexRules as AutomationRule[]) || [];
}

/**
 * Save rules to database
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function saveRulesToDB(workspaceId: string, rules: AutomationRule[]): Promise<void> {
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { settings: true },
    });
    const settings = (workspace?.settings as Record<string, unknown>) || {};
    await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
            settings: {
                ...settings,
                reflexRules: rules,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any, // Prisma JSON field — no typed alternative
        },
    });
}

// ─── Consequence Model ───────────────────────────────────

/**
 * Assesses the consequence of a proposed automation action
 * BEFORE it executes. This is the safety gate.
 */
export function assessConsequence(
    action: AutomationAction,
    autonomyLevel: AutonomyLevel,
    blastRadius: number,
): ConsequenceAssessment {
    // Script execution risk assessment
    if (action.type === 'run_script') {
        const isHighImpact = blastRadius > 5;
        return {
            riskLevel: isHighImpact ? 'high' : blastRadius > 2 ? 'medium' : 'low',
            estimatedImpact: `Script "${action.scriptName || 'unknown'}" will execute on target asset`,
            affectedAssets: Math.max(1, blastRadius),
            reversible: false,
            requiresApproval: autonomyLevel !== 'auto' || isHighImpact,
            reasoning: isHighImpact
                ? 'High blast radius — script affects multiple connected systems'
                : 'Standard script execution with limited scope',
        };
    }

    // Agent restart risk assessment
    if (action.type === 'restart_agent') {
        return {
            riskLevel: blastRadius > 3 ? 'medium' : 'low',
            estimatedImpact: 'Agent will restart, causing brief monitoring gap',
            affectedAssets: 1,
            reversible: true,
            requiresApproval: autonomyLevel !== 'auto',
            reasoning: 'Agent restarts are generally safe but cause a temporary monitoring blind spot',
        };
    }

    // Notification — always safe
    if (action.type === 'send_notification') {
        return {
            riskLevel: 'safe',
            estimatedImpact: 'Notification sent to configured channel',
            affectedAssets: 0,
            reversible: true,
            requiresApproval: false,
            reasoning: 'Notification-only actions have no operational impact',
        };
    }

    // Alert creation — safe
    if (action.type === 'create_alert') {
        return {
            riskLevel: 'safe',
            estimatedImpact: 'New alert rule created for monitoring',
            affectedAssets: 0,
            reversible: true,
            requiresApproval: false,
            reasoning: 'Alert creation is additive-only',
        };
    }

    // Fallback — require approval
    return {
        riskLevel: 'medium',
        estimatedImpact: 'Unknown action type — requires review',
        affectedAssets: blastRadius,
        reversible: false,
        requiresApproval: true,
        reasoning: 'Unrecognized action type; defaulting to cautious assessment',
    };
}

// ─── Rule Management ─────────────────────────────────────
// Rules are persisted to DB via Workspace.settings.

export async function getRules(workspaceId: string): Promise<AutomationRule[]> {
    return loadRulesFromDB(workspaceId);
}

export async function saveRule(
    workspaceId: string,
    rule: AutomationRule,
): Promise<AutomationRule> {
    // Atomic read-modify-write inside a transaction to prevent concurrent
    // saves from clobbering each other's changes.
    await prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.findUnique({
            where: { id: workspaceId },
            select: { settings: true },
        });

        const settings = (workspace?.settings as Record<string, unknown>) || {};
        const rules = (settings.reflexRules as AutomationRule[]) || [];

        const existingIndex = rules.findIndex(r => r.id === rule.id);
        if (existingIndex >= 0) {
            rules[existingIndex] = rule;
        } else {
            rules.push(rule);
        }

        await tx.workspace.update({
            where: { id: workspaceId },
            data: {
                settings: {
                    ...settings,
                    reflexRules: rules,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any,
            },
        });
    });

    return rule;
}

export async function deleteRule(
    workspaceId: string,
    ruleId: string,
): Promise<void> {
    // Atomic read-modify-write to prevent concurrent deletes from conflicting
    await prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.findUnique({
            where: { id: workspaceId },
            select: { settings: true },
        });
        const settings = (workspace?.settings as Record<string, unknown>) || {};
        const rules = ((settings.reflexRules as AutomationRule[]) || []).filter(r => r.id !== ruleId);
        await tx.workspace.update({
            where: { id: workspaceId },
            data: {
                settings: {
                    ...settings,
                    reflexRules: rules,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any,
            },
        });
    });
}

// ─── Action Queue ────────────────────────────────────────

export async function getActionQueue(workspaceId: string): Promise<ActionQueueItem[]> {
    const items = await prisma.actionQueueItem.findMany({
        where: { workspaceId },
        orderBy: { triggeredAt: 'desc' },
        take: 50,
    });

    return items.map((item) => ({
        id: item.id,
        rule: item.ruleSnapshot as unknown as AutomationRule,
        consequence: item.consequence as unknown as ConsequenceAssessment,
        status: item.status as ActionQueueItem['status'],
        triggeredAt: item.triggeredAt,
        executedAt: item.executedAt || undefined,
        result: item.result || undefined,
    }));
}

/**
 * Processes a CORTEX recommendation through the REFLEX pipeline:
 * 1. Find matching automation rule
 * 2. Assess consequence
 * 3. Queue or auto-execute based on autonomy level
 */
export async function processRecommendation(
    workspaceId: string,
    recommendation: Recommendation,
    blastRadius: number,
): Promise<ActionQueueItem | null> {
    const rules = await getRules(workspaceId);

    // Find matching rule (or create an implicit one)
    const matchingRule = rules.find(r =>
        r.enabled &&
        r.action.type === 'run_script' // Simplified matching
    );

    if (!matchingRule) {
        // No matching rule — surface as suggestion only
        return null;
    }

    // Check cooldown
    if (matchingRule.lastTriggeredAt) {
        const cooldownMs = matchingRule.cooldownMinutes * 60 * 1000;
        const elapsed = Date.now() - matchingRule.lastTriggeredAt.getTime();
        if (elapsed < cooldownMs) return null;
    }

    // Assess consequence
    const consequence = assessConsequence(
        matchingRule.action,
        matchingRule.autonomyLevel,
        blastRadius,
    );

    const status = consequence.requiresApproval ? 'pending' : 'executing';

    // Persist to PostgreSQL Action Queue
    const dbItem = await prisma.actionQueueItem.create({
        data: {
            workspaceId,
            ruleId: matchingRule.id,
            ruleName: matchingRule.name,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ruleSnapshot: matchingRule as any, // Prisma JSON field
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            consequence: consequence as any, // Prisma JSON field
            status,
        }
    });

    const queueItem: ActionQueueItem = {
        id: dbItem.id,
        rule: matchingRule,
        consequence,
        status: status as ActionQueueItem['status'],
        triggeredAt: dbItem.triggeredAt,
    };

    // Auto-execute if safe and auto mode
    if (!consequence.requiresApproval) {
        // Execute asynchronously without blocking
        executeAction(workspaceId, queueItem).catch(err => {
            logError('[REFLEX] Async execution failed', err);
        });
    }

    return queueItem;
}

/**
 * Execute an approved action and log it.
 * This is where actual HTTP requests to Agents or 3rd party APIs would fire.
 */
export async function executeAction(
    workspaceId: string,
    item: ActionQueueItem,
): Promise<void> {
    try {
        await prisma.actionQueueItem.update({
            where: { id: item.id },
            data: { status: 'executing' }
        });

        if (item.rule.action.type === 'run_script') {
            // Resolve script body from Script Library if scriptId is provided
            let scriptBody = item.rule.action.message || 'echo "Reflex Auto-Execution Triggered"';
            let scriptLanguage: string = 'bash';

            if (item.rule.action.scriptId) {
                const libraryScript = await prisma.script.findUnique({
                    where: { id: item.rule.action.scriptId },
                    select: { content: true, language: true, name: true },
                });
                if (libraryScript) {
                    scriptBody = libraryScript.content;
                    scriptLanguage = libraryScript.language;
                }
            }

            const agent = await prisma.agentConnection.findFirst({
                where: {
                    workspaceId,
                    status: 'ONLINE',
                    ...(item.rule.action.targetAssetId ? { assetId: item.rule.action.targetAssetId } : {})
                }
            });

            if (agent) {
                await prisma.scriptExecution.create({
                    data: {
                        agentId: agent.id,
                        assetId: agent.assetId,
                        workspaceId,
                        scriptName: item.rule.action.scriptName || item.rule.name,
                        scriptBody,
                        language: scriptLanguage,
                        status: 'PENDING',
                        createdBy: 'REFLEX_ENGINE',
                        ...(item.rule.action.scriptId ? { scriptId: item.rule.action.scriptId } : {}),
                    }
                });

                // Fire webhook notification for script execution
                const { eventType, data } = WebhookEvents.reflexActionExecuted(
                    item.rule.name, 'run_script', 'dispatched',
                    { agentId: agent.id, hostname: agent.hostname }
                );
                fireWebhookAsync(workspaceId, eventType, data);
            } else {
                throw new Error('No online agents available to execute this action.');
            }
        } else if (item.rule.action.type === 'send_notification') {
            // Create an in-app notification audit log entry that the NotificationPopover picks up
            await prisma.auditLog.create({
                data: {
                    workspaceId,
                    action: 'reflex.notification',
                    resourceType: 'notification',
                    resourceId: item.rule.id,
                    details: {
                        channel: item.rule.action.notificationChannel || 'in-app',
                        message: item.rule.action.message || `Automation "${item.rule.name}" triggered`,
                        source: 'REFLEX_ENGINE',
                    },
                },
            });

            // Fire real HTTP webhook delivery to configured workspace endpoint
            const { eventType, data } = WebhookEvents.reflexActionExecuted(
                item.rule.name, 'send_notification', 'delivered',
                { message: item.rule.action.message, channel: item.rule.action.notificationChannel || 'in-app' }
            );
            fireWebhookAsync(workspaceId, eventType, data);

        } else if (item.rule.action.type === 'restart_agent') {
            const agent = await prisma.agentConnection.findFirst({
                where: {
                    workspaceId,
                    status: 'ONLINE',
                    ...(item.rule.action.targetAssetId ? { assetId: item.rule.action.targetAssetId } : {}),
                },
            });

            if (agent) {
                // Use the AGENT'S platform (stored in DB), not the server's process.platform.
                // In production the server runs Linux while agents may be Windows or macOS.
                const isWindows = agent.platform === 'WINDOWS';
                await prisma.scriptExecution.create({
                    data: {
                        agentId: agent.id,
                        assetId: agent.assetId,
                        workspaceId,
                        scriptName: `Restart Agent (${item.rule.name})`,
                        scriptBody: isWindows
                            ? 'Restart-Service GlanusAgent -Force'
                            : 'sudo systemctl restart glanus-agent',
                        language: isWindows ? 'powershell' : 'bash',
                        status: 'PENDING',
                        createdBy: 'REFLEX_ENGINE',
                    },
                });
            } else {
                throw new Error('No online agents available to restart.');
            }

        } else if (item.rule.action.type === 'create_alert') {
            // Create an alert rule in the database
            await prisma.alertRule.create({
                data: {
                    workspaceId,
                    name: item.rule.action.message || `Auto-Alert: ${item.rule.name}`,
                    metric: (item.rule.trigger.metric || 'cpu').toUpperCase() as 'CPU' | 'RAM' | 'DISK',
                    threshold: item.rule.trigger.value ?? 90,
                    severity: 'WARNING',
                    enabled: true,
                },
            });
        }

        // Log to audit trail
        await prisma.auditLog.create({
            data: {
                workspaceId,
                action: `reflex.${item.rule.action.type}`,
                resourceType: 'automation',
                resourceId: item.rule.id,
                details: {
                    ruleName: item.rule.name,
                    actionType: item.rule.action.type,
                    autonomyLevel: item.rule.autonomyLevel,
                    consequenceRisk: item.consequence.riskLevel,
                },
            },
        });

        await prisma.actionQueueItem.update({
            where: { id: item.id },
            data: {
                status: 'completed',
                executedAt: new Date(),
                result: `Action "${item.rule.name}" executed successfully via Reflex Engine`
            }
        });

    } catch (error: unknown) {
        await prisma.actionQueueItem.update({
            where: { id: item.id },
            data: {
                status: 'failed',
                executedAt: new Date(),
                result: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
}

/**
 * Approve a pending action in the queue.
 * Updates the status to 'approved' and triggers execution asynchronously.
 */
export async function approveAction(
    workspaceId: string,
    itemId: string,
): Promise<ActionQueueItem> {
    const dbItem = await prisma.actionQueueItem.update({
        where: { id: itemId, workspaceId, status: 'pending' },
        data: { status: 'approved' },
    });

    const queueItem: ActionQueueItem = {
        id: dbItem.id,
        rule: dbItem.ruleSnapshot as unknown as AutomationRule,
        consequence: dbItem.consequence as unknown as ConsequenceAssessment,
        status: dbItem.status as ActionQueueItem['status'],
        triggeredAt: dbItem.triggeredAt,
    };

    // Execute asynchronously without blocking
    executeAction(workspaceId, queueItem).catch(err => {
        logError('[REFLEX] Async execution failed', err);
    });

    return queueItem;
}

/**
 * Reject a pending action in the queue.
 */
export async function rejectAction(
    workspaceId: string,
    itemId: string,
): Promise<ActionQueueItem> {
    const dbItem = await prisma.actionQueueItem.update({
        where: { id: itemId, workspaceId, status: 'pending' },
        data: {
            status: 'rejected',
            executedAt: new Date(),
            result: 'Rejected by human operator',
        },
    });

    return {
        id: dbItem.id,
        rule: dbItem.ruleSnapshot as unknown as AutomationRule,
        consequence: dbItem.consequence as unknown as ConsequenceAssessment,
        status: dbItem.status as ActionQueueItem['status'],
        triggeredAt: dbItem.triggeredAt,
        executedAt: dbItem.executedAt || undefined,
        result: dbItem.result || undefined,
    };
}
