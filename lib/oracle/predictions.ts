/**
 * ORACLE — Prediction Engine
 * 
 * Forecasts failures, capacity exhaustion, and SLO burn rates
 * based on metric trends and historical patterns from NERVE.
 */

import { prisma } from '@/lib/db';
import { getMetricTrend } from '@/lib/nerve/memory';

// ─── Types ───────────────────────────────────────────────

export interface FailureForecast {
    assetId: string;
    assetName: string;
    metric: 'cpu' | 'ram' | 'disk';
    currentValue: number;
    predictedValue: number;
    thresholdValue: number;
    timeToThreshold: string; // e.g. "~3 hours", "~2 days"
    timeToThresholdMs: number;
    confidence: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface CapacityIntelligence {
    workspaceId: string;
    resources: ResourceCapacity[];
    recommendations: string[];
}

export interface ResourceCapacity {
    resource: string;
    used: number;
    total: number;
    percentUsed: number;
    burnRate: number; // units per day
    daysUntilFull: number | null;
    status: 'healthy' | 'watch' | 'warning' | 'critical';
}

export interface SLOStatus {
    name: string;
    target: number; // e.g. 99.9
    current: number;
    burnRate: number; // Error budget consumed per hour
    errorBudgetRemaining: number; // percentage
    status: 'met' | 'at_risk' | 'breached';
    windowHours: number;
}

// ─── Failure Forecasting ─────────────────────────────────

/**
 * Analyzes metric trends for all agents in a workspace and predicts
 * when thresholds will be breached.
 */
export async function forecastFailures(workspaceId: string): Promise<FailureForecast[]> {
    const agents = await prisma.agentConnection.findMany({
        where: { workspaceId, status: 'ONLINE' },
        select: {
            id: true,
            assetId: true,
            hostname: true,
            cpuUsage: true,
            ramUsage: true,
            diskUsage: true,
            asset: {
                select: { id: true, name: true },
            },
        },
    });

    const forecasts: FailureForecast[] = [];
    const thresholds = { cpu: 90, ram: 90, disk: 95 };

    for (const agent of agents) {
        if (!agent.asset) continue;

        // Analyze each metric
        for (const metric of ['cpu', 'ram', 'disk'] as const) {
            const currentValue = metric === 'cpu' ? agent.cpuUsage ?? 0
                : metric === 'ram' ? agent.ramUsage ?? 0
                    : agent.diskUsage ?? 0;

            // Skip if already above threshold or very low
            if (currentValue >= thresholds[metric] || currentValue < 30) continue;

            // Get 24-hour trend
            const trend = await getMetricTrend(agent.id, metric, 24);
            if (trend.length < 3) continue; // Not enough data

            // Linear regression to predict trend
            const prediction = linearExtrapolation(
                trend.map(t => t.value),
                thresholds[metric],
                trend.map(t => t.timestamp),
            );
            if (!prediction) continue;

            forecasts.push({
                assetId: agent.asset.id,
                assetName: agent.asset.name,
                metric,
                currentValue,
                predictedValue: prediction.predictedValue,
                thresholdValue: thresholds[metric],
                timeToThreshold: formatDuration(prediction.timeToThresholdMs),
                timeToThresholdMs: prediction.timeToThresholdMs,
                confidence: prediction.confidence,
                severity: classifyForecastSeverity(prediction.timeToThresholdMs),
            });
        }
    }

    // Sort by urgency (closest to threshold first)
    forecasts.sort((a, b) => a.timeToThresholdMs - b.timeToThresholdMs);

    return forecasts;
}

// ─── Capacity Intelligence ───────────────────────────────

/**
 * Analyzes workspace resource utilization and projects capacity.
 */
export async function getCapacityIntelligence(workspaceId: string): Promise<CapacityIntelligence> {
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
            subscription: true,
            _count: {
                select: {
                    assets: true,
                    members: true,
                },
            },
        },
    });

    if (!workspace) throw new Error('Workspace not found');

    const sub = workspace.subscription;
    const resources: ResourceCapacity[] = [];
    const recommendations: string[] = [];

    // Assets capacity
    const maxAssets = sub?.maxAssets || 50;
    const assetPercent = Math.round((workspace._count.assets / maxAssets) * 100);
    resources.push({
        resource: 'Assets',
        used: workspace._count.assets,
        total: maxAssets,
        percentUsed: assetPercent,
        burnRate: 0, // Would need historical data for accurate burn rate
        daysUntilFull: assetPercent >= 90 ? 7 : assetPercent >= 70 ? 30 : null,
        status: assetPercent >= 90 ? 'critical' : assetPercent >= 70 ? 'warning' : assetPercent >= 50 ? 'watch' : 'healthy',
    });

    if (assetPercent >= 80) {
        recommendations.push('Consider upgrading your plan to accommodate more assets');
    }

    // AI Credits
    if (sub) {
        const creditPercent = sub.maxAICreditsPerMonth > 0
            ? Math.round((sub.aiCreditsUsed / sub.maxAICreditsPerMonth) * 100)
            : 0;

        // Estimate daily burn rate
        const dayOfMonth = new Date().getDate();
        const dailyBurn = dayOfMonth > 0 ? sub.aiCreditsUsed / dayOfMonth : 0;
        const remainingCredits = sub.maxAICreditsPerMonth - sub.aiCreditsUsed;
        const daysUntilExhausted = dailyBurn > 0 ? Math.round(remainingCredits / dailyBurn) : null;

        resources.push({
            resource: 'AI Credits',
            used: sub.aiCreditsUsed,
            total: sub.maxAICreditsPerMonth,
            percentUsed: creditPercent,
            burnRate: Math.round(dailyBurn),
            daysUntilFull: daysUntilExhausted,
            status: creditPercent >= 90 ? 'critical' : creditPercent >= 70 ? 'warning' : creditPercent >= 50 ? 'watch' : 'healthy',
        });

        if (daysUntilExhausted !== null && daysUntilExhausted < 7) {
            recommendations.push(`AI credits will be exhausted in ~${daysUntilExhausted} days at current rate`);
        }
    }

    // Storage
    if (sub) {
        const storagePercent = sub.maxStorageMB > 0
            ? Math.round((sub.storageUsedMB / sub.maxStorageMB) * 100)
            : 0;

        resources.push({
            resource: 'Storage',
            used: sub.storageUsedMB,
            total: sub.maxStorageMB,
            percentUsed: storagePercent,
            burnRate: 0,
            daysUntilFull: null,
            status: storagePercent >= 90 ? 'critical' : storagePercent >= 70 ? 'warning' : storagePercent >= 50 ? 'watch' : 'healthy',
        });

        if (storagePercent >= 85) {
            recommendations.push('Storage usage is high — consider archiving old data or upgrading');
        }
    }

    return { workspaceId, resources, recommendations };
}

// ─── SLO Burn Tracking ───────────────────────────────────

/**
 * Tracks SLO compliance based on agent uptime over rolling windows.
 */
export async function getSLOStatus(workspaceId: string): Promise<SLOStatus[]> {
    const slos: SLOStatus[] = [];

    // Uptime SLO (based on agent connectivity)
    const agentStats = await prisma.agentConnection.findMany({
        where: { workspaceId },
        select: { status: true },
    });

    if (agentStats.length > 0) {
        const onlineCount = agentStats.filter((a: { status: string }) => a.status === 'ONLINE').length;
        const uptimePercent = (onlineCount / agentStats.length) * 100;

        const target = 99.9;
        const errorBudget = 100 - target; // 0.1%
        const currentErrorRate = 100 - uptimePercent;
        const budgetConsumed = errorBudget > 0 ? (currentErrorRate / errorBudget) * 100 : 0;
        const budgetRemaining = Math.max(0, 100 - budgetConsumed);

        slos.push({
            name: 'Agent Uptime',
            target,
            current: Math.round(uptimePercent * 100) / 100,
            burnRate: Math.round(budgetConsumed / 24 * 100) / 100, // per hour
            errorBudgetRemaining: Math.round(budgetRemaining * 100) / 100,
            status: budgetRemaining > 50 ? 'met'
                : budgetRemaining > 0 ? 'at_risk'
                    : 'breached',
            windowHours: 720, // 30 days
        });
    }

    return slos;
}

// ─── Helpers ─────────────────────────────────────────────

export function linearExtrapolation(
    values: number[],
    threshold: number,
    timestamps?: Date[],
): { predictedValue: number; timeToThresholdMs: number; confidence: number } | null {
    if (values.length < 3) return null;

    // Simple linear regression on last N points
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((s, v) => s + v, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (i - xMean) * (values[i] - yMean);
        denominator += (i - xMean) ** 2;
    }

    if (denominator === 0) return null;

    const slope = numerator / denominator;
    if (slope <= 0) return null; // Trending down — no threshold breach predicted

    const intercept = yMean - slope * xMean;

    // Find x where y = threshold: x = (threshold - intercept) / slope
    const targetStep = (threshold - intercept) / slope;

    // How many steps from the current step (n - 1) until target step?
    const stepsToThreshold = targetStep - (n - 1);
    if (stepsToThreshold <= 0) return null;

    // Compute actual interval per step from timestamps if available,
    // otherwise fall back to estimating from the 24h window and point count
    let msPerStep: number;
    if (timestamps && timestamps.length >= 2) {
        const totalSpanMs = timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime();
        msPerStep = totalSpanMs / (timestamps.length - 1);
    } else {
        // Fallback: assume data spans 24 hours
        msPerStep = (24 * 60 * 60 * 1000) / Math.max(n - 1, 1);
    }

    const timeToThresholdMs = stepsToThreshold * msPerStep;
    const hoursToThreshold = timeToThresholdMs / (60 * 60 * 1000);

    // Confidence decreases with prediction distance
    const confidence = Math.max(0.2, Math.min(0.95, 1 - (hoursToThreshold / 168))); // 168h = 1 week

    return {
        predictedValue: Math.round(threshold),
        timeToThresholdMs,
        confidence: Math.round(confidence * 100) / 100,
    };
}

export function classifyForecastSeverity(timeToThresholdMs: number): FailureForecast['severity'] {
    const hours = timeToThresholdMs / (60 * 60 * 1000);
    if (hours < 2) return 'critical';
    if (hours < 12) return 'high';
    if (hours < 48) return 'medium';
    return 'low';
}

export function formatDuration(ms: number): string {
    const hours = ms / (60 * 60 * 1000);
    if (hours < 1) return `~${Math.round(hours * 60)} minutes`;
    if (hours < 24) return `~${Math.round(hours)} hours`;
    const days = hours / 24;
    if (days < 7) return `~${Math.round(days)} days`;
    return `~${Math.round(days / 7)} weeks`;
}
