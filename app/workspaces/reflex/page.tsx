'use client';

import { useState, useEffect } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import {
    Activity, ShieldAlert, Cpu, Clock,
    Play, XCircle,
    ListFilter, Zap, Plus
} from 'lucide-react';
import type { AutomationRule, ActionQueueItem } from '@/lib/reflex/automation';
import { ReflexRuleForm } from '@/components/workspace/reflex/ReflexRuleForm';
import { ConfirmDialog } from '@/components/ui';

export default function ReflexDashboardPage() {
    const workspaceId = useWorkspaceId();
    const { success, error: showError } = useToast();

    const [activeTab, setActiveTab] = useState<'rules' | 'queue'>('queue');
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [queue, setQueue] = useState<ActionQueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreatingRule, setIsCreatingRule] = useState(false);
    const [confirmState, setConfirmState] = useState<{ open: boolean; ruleId: string | null }>({ open: false, ruleId: null });

    useEffect(() => {
        if (workspaceId) {
            fetchData();
        }
    }, [workspaceId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [rulesRes, queueRes] = await Promise.all([
                csrfFetch(`/api/workspaces/${workspaceId}/reflex/rules`),
                csrfFetch(`/api/workspaces/${workspaceId}/reflex/queue`)
            ]);

            if (rulesRes.ok) {
                const rulesData = await rulesRes.json();
                setRules(rulesData.data || rulesData);
            }
            if (queueRes.ok) {
                const queueData = await queueRes.json();
                setQueue(queueData.data || queueData);
            }
        } catch (_err: unknown) {
            showError('Failed to load Reflex engine data');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/reflex/rules/${ruleId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                success('Rule deleted successfully');
                setRules(rules.filter(r => r.id !== ruleId));
            } else {
                throw new Error('Failed to drop rule');
            }
        } catch (err: unknown) {
            showError('Deletion failed', err instanceof Error ? err.message : undefined);
        }
    };

    const handleActionApproval = async (itemId: string, action: 'approve' | 'reject') => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/reflex/queue/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });

            if (res.ok) {
                success(`Action ${action === 'approve' ? 'approved for execution' : 'rejected'}`);
                fetchData(); // Refresh queue states immediately
            } else {
                throw new Error('Action processing failed');
            }
        } catch (err: unknown) {
            showError(`Failed to ${action} action`, err instanceof Error ? err.message : undefined);
        }
    };

    const getRiskToken = (risk: string) => {
        switch (risk) {
            case 'high':
            case 'dangerous':
                return 'bg-destructive/10 text-destructive border-destructive/20';
            case 'medium':
                return 'bg-amber-500/10 text-warning border-amber-500/20';
            default:
                return 'bg-success/10 text-success border-success/20';
        }
    };

    const getStatusToken = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-amber-500/10 text-warning border-amber-500/20';
            case 'executing': return 'bg-cortex/10 text-cortex border-cortex/20';
            case 'completed': return 'bg-success/10 text-success border-success/20';
            case 'failed':
            case 'rejected': return 'bg-destructive/10 text-destructive border-destructive/20';
            default: return 'bg-muted text-foreground border-border';
        }
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                        <Zap className="text-primary h-6 w-6" />
                        Reflex Automation Engine
                    </h1>
                    <p className="text-muted-foreground mt-1 max-w-2xl">
                        Autonomous operations orchestration. Review pending actions queued by CORTEX and define consequence boundaries for automatic remediations.
                    </p>
                </div>
                {activeTab === 'rules' && !isCreatingRule && (
                    <button onClick={() => setIsCreatingRule(true)} className="btn-primary flex items-center gap-2">
                        <Plus className="w-4 h-4" /> New Rule
                    </button>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-border">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => { setActiveTab('queue'); setIsCreatingRule(false); }}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                            ${activeTab === 'queue'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                            }
                        `}
                    >
                        Pending Actions ({queue.filter(q => q.status === 'pending').length})
                    </button>
                    <button
                        onClick={() => { setActiveTab('rules'); setIsCreatingRule(false); }}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                            ${activeTab === 'rules'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                            }
                        `}
                    >
                        Operations Rules ({rules.length})
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            {activeTab === 'queue' && (
                <div className="space-y-4">
                    {queue.length === 0 ? (
                        <div className="bg-surface-1 border border-border rounded-xl p-12 text-center">
                            <ShieldAlert className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No Actions Queued</h3>
                            <p className="text-muted-foreground">
                                The Reflex engine resolves CORTEX recommendations against your rules natively. Any actions awaiting required Admin validation will appear here.
                            </p>
                        </div>
                    ) : (
                        queue.map((item) => (
                            <div key={item.id} className="bg-surface-1 border border-border rounded-xl overflow-hidden hover:border-border transition-colors">
                                <div className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-medium text-foreground">{item.rule.name || item.consequence?.estimatedImpact}</h3>
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusToken(item.status)}`}>
                                                    {item.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{item.rule.description}</p>
                                        </div>
                                        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-xl flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5" />
                                            {new Date(item.triggeredAt).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Consequence Assessment</h4>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">Blast Radius</span>
                                                    <span className="text-foreground font-medium">{item.consequence?.affectedAssets} system(s)</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">Calculated Risk</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskToken(item.consequence?.riskLevel || 'medium')}`}>
                                                        {item.consequence?.riskLevel?.toUpperCase() || 'UNKNOWN'}
                                                    </span>
                                                </div>
                                                <div className="text-sm">
                                                    <p className="text-muted-foreground mt-2 truncate w-full" title={item.consequence?.reasoning}>
                                                        {item.consequence?.reasoning}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Proposed Action</h4>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 mt-1">
                                                    <div className="p-2 bg-muted rounded-xl text-foreground">
                                                        <Activity className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-foreground">Execute `{item.rule.action.scriptName || item.rule.action.type}`</p>
                                                        <p className="text-xs text-muted-foreground">Autonomy Required: {item.rule.autonomyLevel?.toUpperCase()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {item.status === 'pending' && (
                                        <div className="mt-6 pt-6 border-t border-border flex justify-end gap-3">
                                            <button
                                                onClick={() => handleActionApproval(item.id, 'reject')}
                                                className="btn-secondary"
                                            >
                                                Ignore
                                            </button>
                                            <button
                                                onClick={() => handleActionApproval(item.id, 'approve')}
                                                className="bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl font-medium transition-colors"
                                            >
                                                Approve Execution
                                            </button>
                                        </div>
                                    )}

                                    {(item.status === 'completed' || item.status === 'failed') && item.result && (
                                        <div className="mt-4 p-3 bg-background rounded-xl border border-border">
                                            <p className="text-xs text-muted-foreground font-mono">{item.result}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'rules' && (
                <div className="space-y-4">
                    {isCreatingRule ? (
                        <div className="bg-surface-1 border border-border rounded-xl p-6">
                            <h2 className="text-lg font-bold text-foreground mb-6">Create Automation Rule</h2>
                            <ReflexRuleForm
                                workspaceId={workspaceId}
                                onSuccess={() => { setIsCreatingRule(false); fetchData(); }}
                                onCancel={() => setIsCreatingRule(false)}
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {rules.length === 0 ? (
                                <div className="col-span-full bg-surface-1 border border-border rounded-xl p-12 text-center">
                                    <ListFilter className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-foreground mb-2">No Rules Configured</h3>
                                    <p className="text-muted-foreground mb-6">
                                        Define how Glanus automatically responds to metric thresholds or intelligence insights.
                                    </p>
                                    <button onClick={() => setIsCreatingRule(true)} className="btn-primary">
                                        Create First Rule
                                    </button>
                                </div>
                            ) : (
                                rules.map(rule => (
                                    <div key={rule.id} className="bg-surface-1 border border-border rounded-xl p-5 hover:border-border transition-colors">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-foreground font-medium flex items-center gap-2">
                                                    {rule.name}
                                                    {!rule.enabled && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded">DISABLED</span>}
                                                </h3>
                                                <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                                            </div>
                                            <button onClick={() => setConfirmState({ open: true, ruleId: rule.id })} className="text-muted-foreground hover:text-destructive">
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="bg-background rounded-xl p-3 text-sm border flex items-center gap-3 border-border/50 mb-3">
                                            <div className="bg-amber-500/10 p-1.5 rounded text-amber-500">
                                                {rule.trigger.metric === 'cpu' ? <Cpu className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">When</span> <span className="text-foreground">{rule.trigger.type}</span>
                                            </div>
                                        </div>

                                        <div className="bg-background rounded-xl p-3 text-sm border flex items-center gap-3 border-border/50">
                                            <div className="bg-primary/10 p-1.5 rounded text-primary">
                                                <Play className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Execute</span> <span className="text-foreground">{rule.action.type}</span>
                                                <span className="text-xs text-muted-foreground block mt-0.5">Autonomy Level: {rule.autonomyLevel}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}
            <ConfirmDialog
                open={confirmState.open}
                title="Delete Automation Rule"
                message="Are you sure you want to delete this automation rule?"
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => {
                    if (confirmState.ruleId) handleDeleteRule(confirmState.ruleId);
                    setConfirmState({ open: false, ruleId: null });
                }}
                onCancel={() => setConfirmState({ open: false, ruleId: null })}
            />
        </div>
    );
}
