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

// Metric history map: agentId → recent metrics (pre-loaded once per workspace evaluation)
type MetricHistory = Map<string, { cpuUsage: number | null; ramUsage: number | null; diskUsage: number | null; timestamp: Date }[]>;

export class AlertEvaluator {
    /**
     * Evaluate all enabled alert rules for a workspace.
     * Batch-loads all agent metrics upfront to eliminate N+1 queries.
     */
    async evaluateWorkspace(workspaceId: string): Promise<AlertTrigger[]> {
        const triggers: AlertTrigger[] = [];

        // Get all enabled alert rules
        const rules = await prisma.alertRule.findMany({
            where: { workspaceId, enabled: true },
        });

        if (rules.length === 0) return triggers;

        // Get all agents in workspace with latest metrics
        const agents = await prisma.agentConnection.findMany({
            where: { workspaceId },
            include: {
                asset: { select: { id: true, name: true } },
            },
        });

        if (agents.length === 0) return triggers;

        // ── Batch metrics: 1 SELECT instead of R×A SELECTs ────────────────────
        // Use at least a 5-minute window so zero-duration rules still have recent data
        const maxDuration = Math.max(rules.reduce((max, r) => Math.max(max, r.duration || 0), 0), 5);
        const metricsStartTime = new Date();
        metricsStartTime.setMinutes(metricsStartTime.getMinutes() - maxDuration);

        const allMetrics = await prisma.agentMetric.findMany({
            where: {
                agentId: { in: agents.map((a) => a.id) },
                timestamp: { gte: metricsStartTime },
            },
            orderBy: { timestamp: 'asc' },
            select: { agentId: true, cpuUsage: true, ramUsage: true, diskUsage: true, timestamp: true },
        });

        // Group by agentId for O(1) lookup per rule×agent combination
        const metricsByAgent: MetricHistory = new Map();
        for (const m of allMetrics) {
            const existing = metricsByAgent.get(m.agentId) ?? [];
            existing.push(m);
            metricsByAgent.set(m.agentId, existing);
        }

        // Evaluate each rule against each agent — no more DB calls inside the loop
        for (const rule of rules) {
            for (const agent of agents) {
                const trigger = this.evaluateRule(rule, agent, metricsByAgent);
                if (trigger) triggers.push(trigger);
            }
        }

        return triggers;
    }

    /**
     * Evaluate a single rule against an agent (purely synchronous — metrics pre-loaded).
     */
    private evaluateRule(
        rule: AlertRule,
        agent: AgentWithAsset,
        metricsByAgent: MetricHistory,
    ): AlertTrigger | null {
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
        if (agent.status !== 'ONLINE') return null;

        // Check metric thresholds
        let currentValue: number | null = null;
        switch (metric) {
            case 'CPU': currentValue = agent.cpuUsage; break;
            case 'RAM': currentValue = agent.ramUsage; break;
            case 'DISK': currentValue = agent.diskUsage; break;
        }

        if (currentValue === null || !Number.isFinite(currentValue) || currentValue <= threshold) return null;

        // Check duration via pre-loaded metrics (synchronous — no DB call)
        if (duration > 0) {
            const sustained = this.checkSustainedViolation(agent, metric, threshold, duration, metricsByAgent);
            if (!sustained) return null;
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
     * Check if metric has been over threshold for duration — uses pre-loaded metrics (no DB).
     */
    private checkSustainedViolation(
        agent: AgentWithAsset,
        metric: string,
        threshold: number,
        durationMinutes: number,
        metricsByAgent: MetricHistory,
    ): boolean {
        const startTime = new Date();
        startTime.setMinutes(startTime.getMinutes() - durationMinutes);

        const agentMetrics = (metricsByAgent.get(agent.id) ?? []).filter(
            (m) => m.timestamp >= startTime,
        );

        const currentVolatileValue =
            metric === 'CPU' ? agent.cpuUsage :
                metric === 'RAM' ? agent.ramUsage :
                    agent.diskUsage;

        if (agentMetrics.length === 0) {
            // No history — use live volatile value (Prism Deduplication dropped history < 5% variance)
            return typeof currentVolatileValue === 'number' && Number.isFinite(currentVolatileValue) && currentVolatileValue > threshold;
        }

        const field = metric === 'CPU' ? 'cpuUsage' : metric === 'RAM' ? 'ramUsage' : 'diskUsage';
        const sustainedHistory = agentMetrics.every((m) => {
            const val = m[field as keyof typeof m];
            return typeof val === 'number' && val > threshold;
        });

        return sustainedHistory && typeof currentVolatileValue === 'number' && Number.isFinite(currentVolatileValue) && currentVolatileValue > threshold;
    }

    /**
     * Calculate minutes since last seen.
     */
    private getMinutesOffline(lastSeen: Date): number {
        const diff = Date.now() - new Date(lastSeen).getTime();
        return Math.floor(diff / 1000 / 60);
    }
}

export const alertEvaluator = new AlertEvaluator();
