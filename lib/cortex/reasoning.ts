/**
 * CORTEX — Causal Reasoning Engine
 * 
 * Multi-model reasoning that understands cause, context, and consequence.
 * Uses OpenAI function-calling to provide structured causal analysis,
 * risk scoring, and remediation suggestions.
 */

import { getOpenAIClient, defaultModel } from '@/lib/ai/openai';
import { type EnrichedMetric } from '@/lib/nerve/enrichment';
import { findSimilarPatterns, type PatternMatch } from '@/lib/nerve/memory';
import { getBlastRadius, type OperationalGraphData } from '@/lib/nerve/operational-graph';

// ─── Types ───────────────────────────────────────────────

export interface CausalAnalysis {
    rootCause: string;
    confidence: number; // 0-1
    causalChain: CausalLink[];
    riskScore: number; // 0-100
    affectedSystems: string[];
    recommendations: Recommendation[];
    explanation: Explanation;
}

export interface CausalLink {
    from: string;
    to: string;
    mechanism: string;
    confidence: number;
}

export interface Recommendation {
    action: string;
    priority: 'immediate' | 'soon' | 'planned';
    impact: string;
    effort: 'low' | 'medium' | 'high';
    autonomyLevel: 'suggest' | 'confirm' | 'auto';
}

export interface RiskProfile {
    assetId: string;
    assetName: string;
    riskScore: number; // 0-100
    factors: RiskFactor[];
    trendDirection: 'improving' | 'stable' | 'degrading';
    lastUpdated: Date;
}

export interface RiskFactor {
    name: string;
    weight: number; // 0-1
    currentValue: number;
    threshold: number;
    status: 'healthy' | 'warning' | 'critical';
}

export interface Explanation {
    summary: string; // One-line human-readable summary
    technical: string; // Detailed technical explanation
    businessImpact: string; // Business-level impact description
    confidence: string; // Why we're this confident
}

// ─── OpenAI Function Definitions ─────────────────────────

const causalAnalysisFunctions = [
    {
        type: 'function' as const,
        function: {
            name: 'provide_causal_analysis',
            description: 'Provide a structured causal analysis of an operational event',
            parameters: {
                type: 'object' as const,
                properties: {
                    rootCause: {
                        type: 'string' as const,
                        description: 'The identified root cause of the issue',
                    },
                    confidence: {
                        type: 'number' as const,
                        description: 'Confidence in the root cause (0 to 1)',
                    },
                    causalChain: {
                        type: 'array' as const,
                        items: {
                            type: 'object' as const,
                            properties: {
                                from: { type: 'string' as const },
                                to: { type: 'string' as const },
                                mechanism: { type: 'string' as const },
                                confidence: { type: 'number' as const },
                            },
                            required: ['from', 'to', 'mechanism', 'confidence'] as const,
                        },
                    },
                    riskScore: {
                        type: 'number' as const,
                        description: 'Risk severity score from 0 (benign) to 100 (critical)',
                    },
                    affectedSystems: {
                        type: 'array' as const,
                        items: { type: 'string' as const },
                        description: 'Names of systems affected by this issue',
                    },
                    recommendations: {
                        type: 'array' as const,
                        items: {
                            type: 'object' as const,
                            properties: {
                                action: { type: 'string' as const },
                                priority: { type: 'string' as const, enum: ['immediate', 'soon', 'planned'] as const },
                                impact: { type: 'string' as const },
                                effort: { type: 'string' as const, enum: ['low', 'medium', 'high'] as const },
                                autonomyLevel: { type: 'string' as const, enum: ['suggest', 'confirm', 'auto'] as const },
                            },
                            required: ['action', 'priority', 'impact', 'effort', 'autonomyLevel'] as const,
                        },
                    },
                    explanation: {
                        type: 'object' as const,
                        properties: {
                            summary: { type: 'string' as const },
                            technical: { type: 'string' as const },
                            businessImpact: { type: 'string' as const },
                            confidence: { type: 'string' as const },
                        },
                        required: ['summary', 'technical', 'businessImpact', 'confidence'] as const,
                    },
                },
                required: ['rootCause', 'confidence', 'causalChain', 'riskScore', 'affectedSystems', 'recommendations', 'explanation'] as const,
            },
        },
    },
];

// ─── Causal Analysis ─────────────────────────────────────

/**
 * Performs causal reasoning over an enriched metric event.
 * Gathers context from NERVE (enrichment + memory), then asks CORTEX
 * to reason about root cause, chain of events, and remediation.
 */
export async function analyzeCause(
    enrichedMetric: EnrichedMetric,
    graph: OperationalGraphData,
): Promise<CausalAnalysis> {
    const client = getOpenAIClient();

    // Gather operational context
    const blastRadius = getBlastRadius(graph, enrichedMetric.assetId);
    const affectedNodes = graph.nodes.filter(n => blastRadius.includes(n.id));
    const historicalPatterns = await findSimilarPatterns(
        enrichedMetric.workspaceId,
        'metric.deviation',
    );

    // Build context prompt
    const contextPrompt = buildContextPrompt(enrichedMetric, affectedNodes, historicalPatterns);

    const response = await client.chat.completions.create({
        model: defaultModel,
        messages: [
            {
                role: 'system',
                content: `You are CORTEX, the reasoning engine for Glanus — an AI-native IT operations platform.
                
Your job is to analyze operational events, determine root causes, and provide actionable recommendations.
Be precise, concise, and data-driven. Prioritize accuracy over speculation.

Always consider:
1. The full causal chain (what triggered what)
2. Blast radius (what systems are affected)
3. Historical precedent (has this happened before?)
4. Business impact (what does this mean for the organization?)
5. Remediation options (from least to most disruptive)`,
            },
            {
                role: 'user',
                content: contextPrompt,
            },
        ],
        tools: causalAnalysisFunctions,
        tool_choice: { type: 'function', function: { name: 'provide_causal_analysis' } },
        temperature: 0.3, // Low temperature for factual analysis
    });

    // Extract function call result
    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
        throw new Error('CORTEX: No structured analysis returned');
    }

    const analysis = JSON.parse(toolCall.function.arguments) as CausalAnalysis;
    return analysis;
}

// ─── Risk Profiling ──────────────────────────────────────

/**
 * Builds a risk profile for a specific asset based on its current state,
 * agent metrics, alert history, and dependency position.
 */
export async function buildRiskProfile(
    assetId: string,
    graph: OperationalGraphData,
): Promise<RiskProfile> {
    const node = graph.nodes.find(n => n.id === assetId);
    if (!node) throw new Error(`Asset ${assetId} not found in graph`);

    // Blast radius = higher risk for more connected assets
    const blastRadius = getBlastRadius(graph, assetId);
    const connectivityFactor = Math.min(blastRadius.length / 10, 1); // Normalize to 0-1

    const factors: RiskFactor[] = [];

    // Health factor
    factors.push({
        name: 'System Health',
        weight: 0.35,
        currentValue: node.health,
        threshold: 70,
        status: node.health >= 80 ? 'healthy' : node.health >= 50 ? 'warning' : 'critical',
    });

    // Connectivity factor (more dependencies = higher risk impact)
    factors.push({
        name: 'Dependency Exposure',
        weight: 0.25,
        currentValue: Math.round(connectivityFactor * 100),
        threshold: 50,
        status: connectivityFactor <= 0.3 ? 'healthy' : connectivityFactor <= 0.6 ? 'warning' : 'critical',
    });

    // Agent metrics factors (if available)
    if (node.metadata.cpuUsage !== undefined) {
        const cpu = node.metadata.cpuUsage as number;
        factors.push({
            name: 'CPU Utilization',
            weight: 0.2,
            currentValue: cpu,
            threshold: 80,
            status: cpu <= 60 ? 'healthy' : cpu <= 80 ? 'warning' : 'critical',
        });
    }

    if (node.metadata.diskUsage !== undefined) {
        const disk = node.metadata.diskUsage as number;
        factors.push({
            name: 'Storage Capacity',
            weight: 0.2,
            currentValue: disk,
            threshold: 85,
            status: disk <= 70 ? 'healthy' : disk <= 85 ? 'warning' : 'critical',
        });
    }

    // Compute weighted risk score
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedRisk = factors.reduce((sum, f) => {
        // Invert health to risk (high health = low risk)
        const riskValue = f.name === 'System Health'
            ? (100 - f.currentValue)
            : f.currentValue;
        return sum + (riskValue * f.weight);
    }, 0);

    const riskScore = Math.round(weightedRisk / totalWeight);

    // Trend: compare agent node health to determine direction
    const agentNode = graph.nodes.find(
        n => n.type === 'agent' && graph.edges.some(e => e.source === n.id && e.target === assetId)
    );
    const trendDirection: RiskProfile['trendDirection'] =
        agentNode && agentNode.health >= 80 ? 'improving'
            : agentNode && agentNode.health >= 50 ? 'stable'
                : agentNode ? 'degrading'
                    : 'stable';

    return {
        assetId,
        assetName: node.label,
        riskScore,
        factors,
        trendDirection,
        lastUpdated: new Date(),
    };
}

// ─── Helpers ─────────────────────────────────────────────

function buildContextPrompt(
    metric: EnrichedMetric,
    affectedNodes: { id: string; label: string; health: number }[],
    patterns: PatternMatch[],
): string {
    const deviationSummary = metric.deviations.length > 0
        ? metric.deviations.map(d => `${d.metric.toUpperCase()}: ${d.currentValue}% (baseline: ${d.baselineAvg}%, deviation: ${d.deviationPercent}%, severity: ${d.severity})`).join('\n')
        : 'No significant deviations detected';

    const changeSummary = metric.recentChanges.length > 0
        ? metric.recentChanges.map(c => `- ${c.action} by ${c.actor} at ${c.timestamp.toISOString()}`).join('\n')
        : 'No recent changes';

    const patternSummary = patterns.length > 0
        ? `Found ${patterns.length} similar historical patterns. Most recent: ${patterns[0].description} (${patterns[0].timestamp.toISOString()})`
        : 'No matching historical patterns';

    return `Analyze this operational event:

**Asset**: ${metric.assetName} (${metric.assetId})
**Health Score**: ${metric.healthScore}/100
**Current Metrics**: CPU ${metric.cpuUsage}%, RAM ${metric.ramUsage}%, Disk ${metric.diskUsage}%

**Deviations from Baseline**:
${deviationSummary}

**Recent Changes (last 30 min)**:
${changeSummary}

**Blast Radius**: ${affectedNodes.length} connected systems
${affectedNodes.slice(0, 5).map(n => `- ${n.label} (health: ${n.health})`).join('\n')}

**Historical Precedent**:
${patternSummary}

Determine the root cause, causal chain, risk score, and recommended actions.`;
}
