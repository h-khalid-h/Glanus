'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

import { useEffect, useState, useCallback } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { ExplanationCard } from '@/components/cortex/ExplanationCard';
import { AutomationCenter } from '@/components/reflex/AutomationCenter';
import { OracleDashboard } from '@/components/oracle/OracleDashboard';
import { AnomalyStream } from '@/components/nerve/AnomalyStream';
import type { CausalAnalysis } from '@/lib/cortex/reasoning';
import type { AutomationRule, ActionQueueItem } from '@/lib/reflex/automation';

type Tab = 'nerve' | 'cortex' | 'reflex' | 'oracle';

export default function IntelligencePage() {
    const { error: showError, success: showSuccess } = useToast();
    const workspaceId = useWorkspaceId();

    const [activeTab, setActiveTab] = useState<Tab>('nerve');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // CORTEX state
    const [analysis, setAnalysis] = useState<CausalAnalysis | null>(null);
    const [cortexLoading, setCortexLoading] = useState(false);
    const [cortexError, setCortexError] = useState<string | null>(null);
    const [agents, setAgents] = useState<{ id: string; hostname: string; status: string }[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

    // REFLEX state
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [queue, setQueue] = useState<ActionQueueItem[]>([]);

    // Fetch agents + reflex data on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [agentsRes, reflexRes] = await Promise.all([
                    csrfFetch(`/api/workspaces/${workspaceId}/agents`),
                    csrfFetch(`/api/workspaces/${workspaceId}/intelligence/reflex`),
                ]);

                if (agentsRes.ok) {
                    const agentData = await agentsRes.json();
                    const agentList = agentData.data?.agents || agentData.agents || [];
                    setAgents(agentList);
                }

                if (reflexRes.ok) {
                    const reflexData = await reflexRes.json();
                    setRules(reflexData.data?.rules || []);
                    setQueue(reflexData.data?.queue || []);
                }
            } catch (err: unknown) {
                showError('Failed to load intelligence data:', err instanceof Error ? err.message : 'An unexpected error occurred');
                setError(err instanceof Error ? err.message : 'Something went wrong');
            } finally {
                setIsLoading(false);
            }
        };

        if (workspaceId) fetchData();
    }, [workspaceId]);

    // Run CORTEX analysis on selected agent
    const runAnalysis = useCallback(async (agentId: string) => {
        setSelectedAgent(agentId);
        setCortexLoading(true);
        setCortexError(null);
        setAnalysis(null);

        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/intelligence/cortex`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Analysis failed');
            }

            const data = await res.json();
            setAnalysis(data.data?.analysis || data.analysis);
        } catch (err: unknown) {
            setCortexError(err instanceof Error ? err.message : 'Failed to run analysis');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setCortexLoading(false);
        }
    }, [workspaceId]);

    // REFLEX callbacks
    const handleCreateRule = useCallback(async (rule: Omit<AutomationRule, 'id' | 'workspaceId' | 'createdBy'>) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/intelligence/reflex`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rule),
            });
            if (res.ok) {
                const data = await res.json();
                setRules(prev => [...prev, data.data?.rule || data.rule]);
            }
        } catch (err: unknown) {
            showError('Failed to create rule:', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    }, [workspaceId]);

    const handleToggleRule = useCallback(async (ruleId: string, enabled: boolean) => {
        // Optimistic update
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled } : r));
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/intelligence/reflex?ruleId=${ruleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Server returned an error');
            }
        } catch (err: unknown) {
            // Revert on failure
            setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !enabled } : r));
            showError('Toggle failed', err instanceof Error ? err.message : 'Could not update rule');
        }
    }, [workspaceId, showError]);

    const handleDeleteRule = useCallback(async (ruleId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/intelligence/reflex?ruleId=${ruleId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to delete rule');
            }
            setRules(prev => prev.filter(r => r.id !== ruleId));
        } catch (err: unknown) {
            showError('Failed to delete rule:', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    }, [workspaceId]);

    const handleApproveAction = useCallback(async (actionId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/intelligence/reflex/queue`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: actionId, action: 'approve' }),
            });
            if (res.ok) {
                const data = await res.json();
                setQueue(prev => prev.map(q => q.id === actionId ? data.data?.item || data.item : q));
                showSuccess('Action approved', 'Execution has started.');
            } else { throw new Error(await res.text()); }
        } catch (err: unknown) {
            showError('Failed to approve action:', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    }, [workspaceId]);

    const handleRejectAction = useCallback(async (actionId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/intelligence/reflex/queue`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: actionId, action: 'reject' }),
            });
            if (res.ok) {
                const data = await res.json();
                setQueue(prev => prev.map(q => q.id === actionId ? data.data?.item || data.item : q));
                showSuccess('Action rejected', 'Action has been dismissed.');
            } else { throw new Error(await res.text()); }
        } catch (err: unknown) {
            showError('Failed to reject action:', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    }, [workspaceId]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-40 animate-pulse rounded-xl bg-surface-2" />
                    ))}
                </div>
            </div>
        );
    }


    if (error) return <ErrorState title="Something went wrong" description={error} onRetry={() => window.location.reload()} />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Intelligence</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    AI-powered causal analysis and autonomous automation
                </p>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 rounded-lg bg-surface-1 p-1">
                <button type="button"
                    onClick={() => setActiveTab('nerve')}
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === 'nerve'
                        ? 'bg-nerve/10 text-nerve shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2.625L9.375 5.5l5.25 13L18.375 13H21" />
                    </svg>
                    NERVE
                </button>
                <button type="button"
                    onClick={() => setActiveTab('cortex')}
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === 'cortex'
                        ? 'bg-cortex/10 text-cortex shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    CORTEX
                </button>
                <button type="button"
                    onClick={() => setActiveTab('reflex')}
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === 'reflex'
                        ? 'bg-reflex/10 text-reflex shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                    REFLEX
                </button>
                <button type="button"
                    onClick={() => setActiveTab('oracle')}
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === 'oracle'
                        ? 'bg-oracle/10 text-oracle shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                    </svg>
                    ORACLE
                </button>
            </div>

            {/* NERVE Tab */}
            {activeTab === 'nerve' && (
                <AnomalyStream workspaceId={workspaceId} />
            )}

            {/* CORTEX Tab */}
            {activeTab === 'cortex' && (
                <div className="space-y-6">
                    {/* Agent picker */}
                    <div className="card">
                        <h3 className="mb-3 text-sm font-semibold">Select Agent for Causal Analysis</h3>
                        {agents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                                    🔍
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">No agents connected</p>
                                <p className="mt-1 text-xs text-muted-foreground/70">
                                    Connect an agent to run causal analysis
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {agents.map(agent => (
                                    <button type="button"
                                        key={agent.id}
                                        onClick={() => runAnalysis(agent.id)}
                                        disabled={cortexLoading}
                                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${selectedAgent === agent.id
                                            ? 'border-cortex/40 bg-cortex/5'
                                            : 'border-border hover:border-cortex/20 hover:bg-surface-1'
                                            } ${cortexLoading ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                        <div className={`h-2 w-2 rounded-full ${agent.status === 'ONLINE' ? 'bg-health-good' : 'bg-muted-foreground'
                                            }`} />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">{agent.hostname}</p>
                                            <p className="text-2xs text-muted-foreground capitalize">
                                                {agent.status?.toLowerCase()}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Loading state */}
                    {cortexLoading && (
                        <div className="card flex items-center justify-center py-12">
                            <div className="flex flex-col items-center gap-3">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-cortex border-t-transparent" />
                                <p className="text-sm text-muted-foreground">Running causal analysis...</p>
                                <p className="text-xs text-muted-foreground/70">This uses AI credits</p>
                            </div>
                        </div>
                    )}

                    {/* Error state */}
                    {cortexError && (
                        <div className="card border-destructive/20 bg-destructive/5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                                    <svg className="h-4 w-4 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-destructive">Analysis failed</p>
                                    <p className="text-xs text-muted-foreground">{cortexError}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Analysis result */}
                    {analysis && !cortexLoading && (
                        <ExplanationCard analysis={analysis} />
                    )}

                    {/* Empty state when no analysis run yet */}
                    {!analysis && !cortexLoading && !cortexError && agents.length > 0 && (
                        <div className="card flex flex-col items-center justify-center py-12 text-center">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cortex/10">
                                <svg className="h-6 w-6 text-cortex" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium">Select an agent to analyze</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                CORTEX will identify root causes, causal chains, and provide remediation recommendations
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* REFLEX Tab */}
            {activeTab === 'reflex' && (
                <AutomationCenter
                    workspaceId={workspaceId}
                    rules={rules}
                    queue={queue}
                    onCreateRule={handleCreateRule}
                    onToggleRule={handleToggleRule}
                    onDeleteRule={handleDeleteRule}
                    onApproveAction={handleApproveAction}
                    onRejectAction={handleRejectAction}
                />
            )}
            {/* ORACLE Tab */}
            {activeTab === 'oracle' && (
                <OracleDashboard workspaceId={workspaceId} />
            )}
        </div>
    );
}
