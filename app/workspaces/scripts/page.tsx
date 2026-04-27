'use client';
import { useToast } from '@/lib/toast';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { Terminal, Plus, Trash2, Zap, Rocket, X, CheckCircle, XCircle, Clock, Loader2, History, Calendar } from 'lucide-react';
import { ConfirmDialog, Pagination } from '@/components/ui';
import type { PaginationMeta } from '@/components/ui/Pagination';
import { PageSpinner } from '@/components/ui/Spinner';
import { ScheduledJobsPanel } from '@/components/workspace/scripts/ScheduledJobsPanel';

interface Script {
    id: string;
    name: string;
    description: string | null;
    language: string;
    content: string;
    tags: string[];
    isPublic: boolean;
    _count: { executions: number };
    createdAt: string;
}

interface Agent {
    id: string;
    hostname: string;
    platform: string;
    status: string;
}

interface Execution {
    id: string;
    scriptName: string;
    language: string;
    status: string;
    output: string | null;
    exitCode: number | null;
    createdAt: string;
    completedAt: string | null;
    agent: Agent | null;
    script: { id: string; name: string; language: string } | null;
}

export default function ScriptsLibraryPage() {
    const { success, error: showError } = useToast();
    const workspaceId = useWorkspaceId();

    const [scripts, setScripts] = useState<Script[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal States
    const [isCreating, setIsCreating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Deploy Modal
    const [deployTarget, setDeployTarget] = useState<Script | null>(null);
    const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
    const [isDeploying, setIsDeploying] = useState(false);
    const [loadingAgents, setLoadingAgents] = useState(false);

    // Execution History & Schedules
    const [showHistory, setShowHistory] = useState(false);
    const [showSchedules, setShowSchedules] = useState(false);
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [execPagination, _setExecPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });

    // Confirm dialog state
    const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
        open: false, title: '', message: '', onConfirm: () => {},
    });

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        language: 'powershell',
        content: '# Enter your script here...',
    });

    useEffect(() => {
        if (workspaceId) {
            fetchScripts();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    const fetchScripts = async () => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/scripts`);
            const data = await res.json();
            if (res.ok) {
                setScripts(data.data?.scripts || []);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to fetch scripts';
            setError(msg);
            showError('Load Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const fetchExecutionHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/scripts/executions?limit=100`);
            const data = await res.json();
            if (res.ok) {
                setExecutions(data.data?.executions || []);
            }
        } catch {
            showError('Load Error', 'Failed to fetch execution history');
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleCancelExecution = (exec: Execution) => {
        setConfirmState({
            open: true,
            title: 'Cancel Execution',
            message: `Force-terminate the "${exec.scriptName}" execution on ${exec.agent?.hostname || 'this agent'}? Use this only when the agent is stuck or unreachable.`,
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, open: false }));
                try {
                    const res = await csrfFetch(
                        `/api/workspaces/${workspaceId}/scripts/executions/${exec.id}/cancel`,
                        { method: 'POST' },
                    );
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error?.message || 'Cancel failed.');
                    success('Execution Cancelled', data.meta?.message || 'Execution marked as failed.');
                    fetchExecutionHistory();
                } catch (err: unknown) {
                    showError('Cancel Error', err instanceof Error ? err.message : 'An error occurred.');
                }
            },
        });
    };

    const handleCreateScript = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/scripts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to craft script template.');
            }

            success('Success', 'Script saved to repository.');
            setIsCreating(false);
            setFormData({ name: '', description: '', language: 'powershell', content: '' });
            fetchScripts();
        } catch (err: unknown) {
            showError('Creation Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteScript = (scriptId: string) => {
        setConfirmState({
            open: true,
            title: 'Delete Script',
            message: 'Are you sure you want to permanently delete this script? This action cannot be undone.',
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, open: false }));
                try {
                    const res = await csrfFetch(`/api/workspaces/${workspaceId}/scripts/${scriptId}`, {
                        method: 'DELETE'
                    });
                    if (!res.ok) throw new Error('Failed to delete script');
                    success('Deleted', 'Script removed from library.');
                    fetchScripts();
                } catch (err: unknown) {
                    showError('Deletion Failed', err instanceof Error ? err.message : 'Failed to delete');
                }
            },
        });
    };

    const openDeployModal = async (script: Script) => {
        setDeployTarget(script);
        setSelectedAgentIds([]);
        setLoadingAgents(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/agents`);
            const data = await res.json();
            if (res.ok) {
                setAvailableAgents((data.data?.agents || []).filter((a: Agent) => a.status === 'ONLINE'));
            }
        } catch {
            showError('Load Error', 'Failed to load agents');
        } finally {
            setLoadingAgents(false);
        }
    };

    const handleDeploy = async () => {
        if (!deployTarget || selectedAgentIds.length === 0) return;
        setIsDeploying(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/scripts/${deployTarget.id}/deploy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetAgentIds: selectedAgentIds })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error?.message || 'Deployment failed.');
            }

            const deployed = data.data?.deployedCount || selectedAgentIds.length;
            const skipped = data.data?.skippedCount || 0;
            success('Deployed', `Script dispatched to ${deployed} agents.${skipped > 0 ? ` ${skipped} agents were offline and skipped.` : ''}`);
            setDeployTarget(null);
            fetchScripts(); // Refresh execution counts
        } catch (err: unknown) {
            showError('Deployment Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsDeploying(false);
        }
    };

    const toggleAgentSelection = (agentId: string) => {
        setSelectedAgentIds(prev =>
            prev.includes(agentId)
                ? prev.filter(id => id !== agentId)
                : [...prev, agentId]
        );
    };

    const selectAllAgents = () => {
        if (selectedAgentIds.length === availableAgents.length) {
            setSelectedAgentIds([]);
        } else {
            setSelectedAgentIds(availableAgents.map(a => a.id));
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SUCCESS': return <CheckCircle size={14} className="text-success" />;
            case 'FAILED': return <XCircle size={14} className="text-destructive" />;
            case 'RUNNING': return <Loader2 size={14} className="text-cortex animate-spin" />;
            case 'PENDING': return <Clock size={14} className="text-warning" />;
            default: return <Clock size={14} className="text-muted-foreground" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SUCCESS': return 'text-success';
            case 'FAILED': return 'text-destructive';
            case 'RUNNING': return 'text-cortex';
            case 'PENDING': return 'text-warning';
            default: return 'text-muted-foreground';
        }
    };

    if (loading) return <PageSpinner />;
    if (error) return <ErrorState title="Failed to load scripts" description={error} onRetry={() => { setError(null); setLoading(true); fetchScripts(); }} />;

    return (
        <>
            <ConfirmDialog
                open={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
            />
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">Script Library</h1>
                    <p className="text-muted-foreground">Manage centralized execution payloads for your RMM fleet.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setShowHistory(!showHistory); setShowSchedules(false); if (!showHistory) fetchExecutionHistory(); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${showHistory ? 'bg-primary/10 border-primary text-primary' : 'border-border text-foreground hover:bg-muted'}`}
                    >
                        <History size={18} />
                        <span>Execution Log</span>
                    </button>
                    <button
                        onClick={() => { setShowSchedules(!showSchedules); setShowHistory(false); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${showSchedules ? 'bg-primary/10 border-primary text-primary' : 'border-border text-foreground hover:bg-muted'}`}
                    >
                        <Calendar size={18} />
                        <span>Schedules</span>
                    </button>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-foreground rounded-xl hover:brightness-110 transition-colors shadow-lg shadow-primary/20"
                    >
                        <Plus size={18} />
                        <span>New Script</span>
                    </button>
                </div>
            </div>

            {/* Scheduled Jobs Panel */}
            {showSchedules && (
                <ScheduledJobsPanel workspaceId={workspaceId} availableScripts={scripts} />
            )}

            {/* Execution History Panel */}
            {showHistory && (
                <div className="mb-8 rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <History size={18} className="text-primary" />
                            Execution History
                        </h2>
                        <span className="text-xs text-muted-foreground">{execPagination.total} records</span>
                    </div>
                    {loadingHistory ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : executions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No executions recorded yet. Deploy a script to see results here.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Script</th>
                                        <th className="px-6 py-3">Agent</th>
                                        <th className="px-6 py-3">Language</th>
                                        <th className="px-6 py-3">Exit Code</th>
                                        <th className="px-6 py-3">Started</th>
                                        <th className="px-6 py-3">Completed</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {executions.map(exec => (
                                        <tr key={exec.id} className="hover:bg-muted/30 transition">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(exec.status)}
                                                    <span className={`text-sm font-medium ${getStatusColor(exec.status)}`}>{exec.status}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-sm text-foreground">{exec.script?.name || exec.scriptName}</td>
                                            <td className="px-6 py-3 text-sm text-foreground">{exec.agent?.hostname || 'Unknown'}</td>
                                            <td className="px-6 py-3">
                                                <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground uppercase font-mono">{exec.language}</span>
                                            </td>
                                            <td className="px-6 py-3 text-sm font-mono text-muted-foreground">{exec.exitCode !== null ? exec.exitCode : '—'}</td>
                                            <td className="px-6 py-3 text-xs text-muted-foreground">{new Date(exec.createdAt).toLocaleString()}</td>
                                            <td className="px-6 py-3 text-xs text-muted-foreground">{exec.completedAt ? new Date(exec.completedAt).toLocaleString() : '—'}</td>
                                            <td className="px-6 py-3 text-right">
                                                {(exec.status === 'RUNNING' || exec.status === 'PENDING') ? (
                                                    <button
                                                        onClick={() => handleCancelExecution(exec)}
                                                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                                                        title="Force-terminate this execution"
                                                    >
                                                        <X size={12} />
                                                        Cancel
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/40">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="px-6 pb-4">
                        <Pagination pagination={execPagination} onPageChange={fetchExecutionHistory} noun="executions" />
                    </div>
                </div>
            )}

            {scripts.length === 0 && !isCreating ? (
                <div className="text-center py-16 px-4 rounded-xl border border-border bg-muted/30">
                    <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                        <Terminal className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-medium text-foreground mb-2">No scripts found</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                        Your library is empty. Create Bash, PowerShell, or Python payloads to deploy across your managed assets.
                    </p>
                    <button onClick={() => setIsCreating(true)} className="px-6 py-2 bg-primary text-foreground rounded-md hover:brightness-110 transition font-medium">
                        Create First Script
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {scripts.map(script => (
                        <div key={script.id} className="rounded-xl border border-border bg-card backdrop-blur-sm p-6 hover:border-border transition relative group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-semibold text-lg text-foreground mb-1">{script.name}</h3>
                                    <span className="text-xs px-2 py-1 rounded bg-muted text-foreground uppercase tracking-wider font-mono">
                                        {script.language}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleDeleteScript(script.id)}
                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition opacity-0 group-hover:opacity-100"
                                    title="Delete Script"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6 line-clamp-2 h-10">
                                {script.description || 'No description provided.'}
                            </p>
                            <div className="flex items-center justify-between mt-auto">
                                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <Zap size={14} /> {script._count.executions} Deployments
                                </span>
                                <button
                                    onClick={() => openDeployModal(script)}
                                    className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition"
                                >
                                    <Rocket size={14} />
                                    Deploy Fleet
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Creation Modal Overlay */}
            {isCreating && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface-1 border border-border rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="create-script-title">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-card">
                            <h2 id="create-script-title" className="text-xl font-semibold flex items-center gap-2 text-foreground">
                                <Terminal size={20} className="text-primary" />
                                Compose Script Payload
                            </h2>
                            <button onClick={() => setIsCreating(false)} className="text-muted-foreground hover:text-foreground transition" aria-label="Close">✕</button>
                        </div>
                        <form onSubmit={handleCreateScript} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Script Name</label>
                                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="e.g., Restart Print Spooler" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Environment Language</label>
                                    <select value={formData.language} onChange={e => setFormData({ ...formData, language: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                                        <option value="powershell">PowerShell (.ps1)</option>
                                        <option value="bash">Bash Script (.sh)</option>
                                        <option value="python">Python 3 (.py)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                                <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Target scenario or use-case..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Raw Payload (Code)</label>
                                <textarea required value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} rows={12} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-mono text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Write your executable code here..." spellCheck={false} />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted text-foreground transition">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-xl bg-primary text-foreground text-sm font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-2 transition">
                                    {isSubmitting ? 'Saving...' : 'Deploy to Library'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Fleet Deploy Modal */}
            {deployTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface-1 border border-border rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="deploy-modal-title">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-card">
                            <h2 id="deploy-modal-title" className="text-xl font-semibold flex items-center gap-2 text-foreground">
                                <Rocket size={20} className="text-primary" />
                                Deploy: {deployTarget.name}
                            </h2>
                            <button onClick={() => setDeployTarget(null)} className="text-muted-foreground hover:text-foreground transition" aria-label="Close">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Script Summary */}
                            <div className="bg-background rounded-xl p-4 border border-border">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Payload Preview</span>
                                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground uppercase font-mono">{deployTarget.language}</span>
                                </div>
                                <pre className="text-xs text-muted-foreground font-mono max-h-24 overflow-y-auto whitespace-pre-wrap">{deployTarget.content.slice(0, 300)}{deployTarget.content.length > 300 ? '...' : ''}</pre>
                            </div>

                            {/* Agent Selection */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-sm font-medium text-foreground">Select Target Agents ({selectedAgentIds.length}/{availableAgents.length})</label>
                                    <button
                                        type="button"
                                        onClick={selectAllAgents}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        {selectedAgentIds.length === availableAgents.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>

                                {loadingAgents ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                                    </div>
                                ) : availableAgents.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
                                        <p>No online agents available.</p>
                                        <p className="text-xs mt-1">Agents must be ONLINE to receive deployments.</p>
                                    </div>
                                ) : (
                                    <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-xl divide-y divide-border">
                                        {availableAgents.map(agent => (
                                            <label
                                                key={agent.id}
                                                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition ${selectedAgentIds.includes(agent.id) ? 'bg-primary/5' : ''}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAgentIds.includes(agent.id)}
                                                    onChange={() => toggleAgentSelection(agent.id)}
                                                    className="rounded border-border text-primary focus:ring-primary bg-background"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm text-foreground truncate">{agent.hostname}</div>
                                                    <div className="text-xs text-muted-foreground">{agent.platform}</div>
                                                </div>
                                                <span className="flex items-center gap-1 text-xs text-success">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                                                    Online
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                            <button type="button" onClick={() => setDeployTarget(null)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted text-foreground transition">Cancel</button>
                            <button
                                onClick={handleDeploy}
                                disabled={isDeploying || selectedAgentIds.length === 0}
                                className="px-5 py-2 rounded-xl bg-primary text-foreground text-sm font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-2 transition shadow-lg shadow-primary/20"
                            >
                                {isDeploying ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Deploying...
                                    </>
                                ) : (
                                    <>
                                        <Rocket size={16} />
                                        Deploy to {selectedAgentIds.length} Agent{selectedAgentIds.length !== 1 ? 's' : ''}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
