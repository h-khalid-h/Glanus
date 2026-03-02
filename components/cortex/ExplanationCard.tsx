'use client';

import type { CausalAnalysis, Recommendation } from '@/lib/cortex/reasoning';

interface ExplanationCardProps {
    analysis: CausalAnalysis;
    compact?: boolean;
}

/**
 * CORTEX Explanation Layer — renders causal analysis results in a
 * multi-layered card: summary → technical → business impact.
 */
export function ExplanationCard({ analysis, compact = false }: ExplanationCardProps) {
    const riskBadgeClass = analysis.riskScore >= 70
        ? 'bg-health-critical/10 text-health-critical border-health-critical/20'
        : analysis.riskScore >= 40
            ? 'bg-oracle/10 text-oracle border-oracle/20'
            : 'bg-health-good/10 text-health-good border-health-good/20';

    return (
        <div className="card space-y-4">
            {/* Header with risk badge */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cortex/10">
                        <svg className="h-4 w-4 text-cortex" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold">CORTEX Analysis</h3>
                        <p className="text-xs text-muted-foreground">
                            Confidence: {Math.round(analysis.confidence * 100)}%
                        </p>
                    </div>
                </div>

                <span className={`badge ${riskBadgeClass}`}>
                    Risk: {analysis.riskScore}
                </span>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-surface-1 p-3">
                <p className="text-sm font-medium">{analysis.explanation.summary}</p>
            </div>

            {/* Root cause */}
            <div>
                <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Root Cause
                </h4>
                <p className="text-sm text-foreground">{analysis.rootCause}</p>
            </div>

            {/* Technical details (expandable in compact mode) */}
            {!compact && (
                <>
                    <div>
                        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Technical Detail
                        </h4>
                        <p className="text-sm text-muted-foreground">{analysis.explanation.technical}</p>
                    </div>

                    <div>
                        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Business Impact
                        </h4>
                        <p className="text-sm text-muted-foreground">{analysis.explanation.businessImpact}</p>
                    </div>

                    {/* Causal chain */}
                    {analysis.causalChain.length > 0 && (
                        <div>
                            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Causal Chain
                            </h4>
                            <div className="space-y-1.5">
                                {analysis.causalChain.map((link, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2 text-xs"
                                    >
                                        <span className="font-medium text-foreground">{link.from}</span>
                                        <span className="text-cortex">→</span>
                                        <span className="font-medium text-foreground">{link.to}</span>
                                        <span className="text-muted-foreground">({link.mechanism})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Recommendations */}
            {analysis.recommendations.length > 0 && (
                <div>
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Recommendations
                    </h4>
                    <div className="space-y-2">
                        {analysis.recommendations.map((rec, i) => (
                            <RecommendationRow key={i} recommendation={rec} />
                        ))}
                    </div>
                </div>
            )}

            {/* Affected systems */}
            {analysis.affectedSystems.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {analysis.affectedSystems.map((sys, i) => (
                        <span
                            key={i}
                            className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground"
                        >
                            {sys}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function RecommendationRow({ recommendation }: { recommendation: Recommendation }) {
    const priorityColors = {
        immediate: 'bg-health-critical/10 text-health-critical',
        soon: 'bg-oracle/10 text-oracle',
        planned: 'bg-nerve/10 text-nerve',
    };

    const autonomyIcons = {
        suggest: '💡',
        confirm: '✅',
        auto: '⚡',
    };

    return (
        <div className="flex items-start gap-2 rounded-lg bg-surface-1 px-3 py-2.5">
            <span className="mt-0.5 text-sm">{autonomyIcons[recommendation.autonomyLevel]}</span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{recommendation.action}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{recommendation.impact}</p>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-2xs font-medium ${priorityColors[recommendation.priority]}`}>
                {recommendation.priority}
            </span>
        </div>
    );
}
