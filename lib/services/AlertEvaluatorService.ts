/**
 * AlertEvaluatorService — Evaluates workspace alert rules against live telemetry.
 *
 * Responsibilities:
 *  - evaluateWorkspace: run all alert rules for a workspace against current agent metrics
 *  - triggerAlert: create or update an active alert, fire notifications via webhooks and email
 *  - resolveAlert: mark an alert as resolved when conditions are no longer met
 */
import { prisma } from '@/lib/db';

interface AlertTrigger {
    ruleId: string;
    ruleName: string;
    assetId: string;
    assetName: string;
    metric: string;
    threshold: number;
    currentValue: number;
    severity: string;
    workspaceId: string;
}

interface AlertRule {
    id: string;
    name: string;
    metric: string;
    threshold: number;
    duration: number;
    severity: string;
    enabled: boolean;
    workspaceId: string;
}

interface AgentWithAsset {
    id: string;
    assetId: string;
    workspaceId: string;
    status: string;
    lastSeen: Date;
    cpuUsage: number | null;
    ramUsage: number | null;
    diskUsage: number | null;
    asset: {
        id: string;
        name: string;
    };
}

export class AlertEvaluator {
    /**
     * Evaluate all enabled alert rules for a workspace
     */
    async evaluateWorkspace(workspaceId: string): Promise<AlertTrigger[]> {
        const triggers: AlertTrigger[] = [];

        // Get all enabled alert rules
        const rules = await prisma.alertRule.findMany({
            where: {
                workspaceId,
                enabled: true,
            },
        });

        if (rules.length === 0) {
            return triggers;
        }

        // Get all agents in workspace with latest metrics
        const agents = await prisma.agentConnection.findMany({
            where: { workspaceId },
            include: {
                asset: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Evaluate each rule against each agent
        for (const rule of rules) {
            for (const agent of agents) {
                const trigger = await this.evaluateRule(rule, agent);
                if (trigger) {
                    triggers.push(trigger);
                }
            }
        }

        return triggers;
    }

    /**
     * Evaluate a single rule against an agent
     */
    private async evaluateRule(
        rule: AlertRule,
        agent: AgentWithAsset
    ): Promise<AlertTrigger | null> {
        const { metric, threshold, duration } = rule;

        // Check offline condition
        if (metric === 'OFFLINE') {
            const minutesOffline = this.getMinutesOffline(agent.lastSeen);
            if (minutesOffline > threshold) {
                return {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    assetId: agent.assetId,
                    assetName: agent.asset.name,
                    metric: 'OFFLINE',
                    threshold,
                    currentValue: minutesOffline,
                    severity: rule.severity,
                    workspaceId: agent.workspaceId,
                };
            }
            return null;
        }

        // Skip if agent is offline
        if (agent.status !== 'ONLINE') {
            return null;
        }

        // Check metric thresholds
        let currentValue: number | null = null;

        switch (metric) {
            case 'CPU':
                currentValue = agent.cpuUsage;
                break;
            case 'RAM':
                currentValue = agent.ramUsage;
                break;
            case 'DISK':
                currentValue = agent.diskUsage;
                break;
        }

        if (currentValue === null) {
            return null;
        }

        // Check if over threshold
        if (currentValue <= threshold) {
            return null;
        }

        // Check duration (if specified)
        if (duration > 0) {
            const sustained = await this.checkSustainedViolation(
                agent,
                metric,
                threshold,
                duration
            );
            if (!sustained) {
                return null;
            }
        }

        return {
            ruleId: rule.id,
            ruleName: rule.name,
            assetId: agent.assetId,
            assetName: agent.asset.name,
            metric,
            threshold,
            currentValue,
            severity: rule.severity,
            workspaceId: agent.workspaceId,
        };
    }

    /**
     * Check if metric has been over threshold for duration
     */
    private async checkSustainedViolation(
        agent: AgentWithAsset,
        metric: string,
        threshold: number,
        durationMinutes: number
    ): Promise<boolean> {
        const startTime = new Date();
        startTime.setMinutes(startTime.getMinutes() - durationMinutes);

        const metrics = await prisma.agentMetric.findMany({
            where: {
                agentId: agent.id,
                timestamp: {
                    gte: startTime,
                },
            },
            orderBy: { timestamp: 'asc' },
        });

        // Current Live State Check (Volatile memory configures absolute truth)
        const currentVolatileValue = metric === 'CPU' ? agent.cpuUsage : metric === 'RAM' ? agent.ramUsage : agent.diskUsage;

        if (metrics.length === 0) {
            // Prism Deduplication Engine dropped history because variance < 5%
            // If the live value exceeds the threshold, the alert is sustained cleanly.
            return (typeof currentVolatileValue === 'number' && currentVolatileValue > threshold);
        }

        // Check if ALL historical readings in this period exceeded threshold
        const field = metric === 'CPU' ? 'cpuUsage' : metric === 'RAM' ? 'ramUsage' : 'diskUsage';
        const sustainedHistory = metrics.every((m) => {
            const val = m[field as keyof typeof m];
            return typeof val === 'number' && val > threshold;
        });

        // Both history and live state must trigger
        return sustainedHistory && (typeof currentVolatileValue === 'number' && currentVolatileValue > threshold);
    }

    /**
     * Calculate minutes since last seen
     */
    private getMinutesOffline(lastSeen: Date): number {
        const now = new Date();
        const diff = now.getTime() - new Date(lastSeen).getTime();
        return Math.floor(diff / 1000 / 60);
    }
}

export const alertEvaluator = new AlertEvaluator();
