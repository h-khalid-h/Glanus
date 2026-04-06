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
                return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'medium':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            default:
                return 'bg-green-500/10 text-green-400 border-green-500/20';
        }
    };

    const getStatusToken = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'executing': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/20';
            case 'failed':
            case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/20';
            default: return 'bg-slate-800 text-slate-300 border-slate-700';
        }
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nerve" />
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                        <Zap className="text-nerve h-6 w-6" />
                        Reflex Automation Engine
                    </h1>
                    <p className="text-slate-400 mt-1 max-w-2xl">
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
            <div className="border-b border-slate-800">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => { setActiveTab('queue'); setIsCreatingRule(false); }}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                            ${activeTab === 'queue'
                                ? 'border-nerve text-nerve'
                                : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
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
                                ? 'border-nerve text-nerve'
                                : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
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
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                            <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No Actions Queued</h3>
                            <p className="text-slate-400">
                                The Reflex engine resolves CORTEX recommendations against your rules natively. Any actions awaiting required Admin validation will appear here.
                            </p>
                        </div>
                    ) : (
                        queue.map((item) => (
                            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
                                <div className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-medium text-foreground">{item.rule.name || item.consequence?.estimatedImpact}</h3>
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusToken(item.status)}`}>
                                                    {item.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-400">{item.rule.description}</p>
                                        </div>
                                        <span className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5" />
                                            {new Date(item.triggeredAt).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800/50">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Consequence Assessment</h4>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-400">Blast Radius</span>
                                                    <span className="text-slate-200 font-medium">{item.consequence?.affectedAssets} system(s)</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-400">Calculated Risk</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskToken(item.consequence?.riskLevel || 'medium')}`}>
                                                        {item.consequence?.riskLevel?.toUpperCase() || 'UNKNOWN'}
                                                    </span>
                                                </div>
                                                <div className="text-sm">
                                                    <p className="text-slate-500 mt-2 truncate w-full" title={item.consequence?.reasoning}>
                                                        {item.consequence?.reasoning}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800/50">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Proposed Action</h4>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 mt-1">
                                                    <div className="p-2 bg-slate-800 rounded-lg text-slate-300">
                                                        <Activity className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-foreground">Execute `{item.rule.action.scriptName || item.rule.action.type}`</p>
                                                        <p className="text-xs text-slate-400">Autonomy Required: {item.rule.autonomyLevel?.toUpperCase()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {item.status === 'pending' && (
                                        <div className="mt-6 pt-6 border-t border-slate-800 flex justify-end gap-3">
                                            <button
                                                onClick={() => handleActionApproval(item.id, 'reject')}
                                                className="btn-secondary"
                                            >
                                                Ignore
                                            </button>
                                            <button
                                                onClick={() => handleActionApproval(item.id, 'approve')}
                                                className="bg-nerve/10 hover:bg-nerve/20 text-nerve px-4 py-2 rounded-lg font-medium transition-colors"
                                            >
                                                Approve Execution
                                            </button>
                                        </div>
                                    )}

                                    {(item.status === 'completed' || item.status === 'failed') && item.result && (
                                        <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800">
                                            <p className="text-xs text-slate-400 font-mono">{item.result}</p>
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
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
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
                                <div className="col-span-full bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                                    <ListFilter className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-foreground mb-2">No Rules Configured</h3>
                                    <p className="text-slate-400 mb-6">
                                        Define how Glanus automatically responds to metric thresholds or intelligence insights.
                                    </p>
                                    <button onClick={() => setIsCreatingRule(true)} className="btn-primary">
                                        Create First Rule
                                    </button>
                                </div>
                            ) : (
                                rules.map(rule => (
                                    <div key={rule.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-foreground font-medium flex items-center gap-2">
                                                    {rule.name}
                                                    {!rule.enabled && <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">DISABLED</span>}
                                                </h3>
                                                <p className="text-sm text-slate-500 mt-1">{rule.description}</p>
                                            </div>
                                            <button onClick={() => setConfirmState({ open: true, ruleId: rule.id })} className="text-slate-500 hover:text-red-400">
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="bg-slate-950 rounded-lg p-3 text-sm border flex items-center gap-3 border-slate-800/50 mb-3">
                                            <div className="bg-amber-500/10 p-1.5 rounded text-amber-500">
                                                {rule.trigger.metric === 'cpu' ? <Cpu className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <span className="text-slate-400">When</span> <span className="text-slate-200">{rule.trigger.type}</span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-950 rounded-lg p-3 text-sm border flex items-center gap-3 border-slate-800/50">
                                            <div className="bg-nerve/10 p-1.5 rounded text-nerve">
                                                <Play className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Execute</span> <span className="text-slate-200">{rule.action.type}</span>
                                                <span className="text-xs text-slate-500 block mt-0.5">Autonomy Level: {rule.autonomyLevel}</span>
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
