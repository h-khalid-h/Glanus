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
    const rules = await loadRulesFromDB(workspaceId);
    const existingIndex = rules.findIndex(r => r.id === rule.id);

    if (existingIndex >= 0) {
        rules[existingIndex] = rule;
    } else {
        rules.push(rule);
    }

    await saveRulesToDB(workspaceId, rules);
    return rule;
}

export async function deleteRule(
    workspaceId: string,
    ruleId: string,
): Promise<void> {
    const rules = await loadRulesFromDB(workspaceId);
    const filtered = rules.filter(r => r.id !== ruleId);
    await saveRulesToDB(workspaceId, filtered);
}

// ─── Action Queue ────────────────────────────────────────

export async function getActionQueue(workspaceId: string): Promise<ActionQueueItem[]> {
    const items = await prisma.actionQueueItem.findMany({
        where: { workspaceId },
        orderBy: { triggeredAt: 'desc' },
        take: 50,
    });

    return items.map(item => ({
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
            ruleSnapshot: matchingRule as any, // Prisma JSON field
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

        // -------------------------------------------------------------
        // IMPLEMENTATION: This is where we would trigger actual webhooks
        // or send commands to the WebRTC signaling layer for agents.
        // For now, we simulate success with a delay to prove durability.
        // -------------------------------------------------------------
        await new Promise(resolve => setTimeout(resolve, 1000));

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
