'use client';
import { useState, useEffect, Suspense } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { ConfirmDialog } from '@/components/ui';
import { ShieldAlert, Plus, ShieldCheck, Play, Server, Terminal, Trash2, X } from 'lucide-react';

interface Script {
    id: string;
    name: string;
    language: string;
}

interface PatchPolicy {
    id: string;
    name: string;
    targetSoftware: string;
    actionScriptId: string;
    isEnabled: boolean;
    vulnerableCount?: number;
    actionScript: {
        id: string;
        name: string;
        language: string;
    };
    createdAt: string;
}

function PatchPoliciesContent() {
    const workspaceId = useWorkspaceId();
    const { success, error: showError } = useToast();

    const [policies, setPolicies] = useState<PatchPolicy[]>([]);
    const [scripts, setScripts] = useState<Script[]>([]);
    const [loading, setLoading] = useState(true);
    const [executingId, setExecutingId] = useState<string | null>(null);

    // Confirm dialog state
    const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
        open: false, title: '', message: '', onConfirm: () => {},
    });

    // Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        targetSoftware: '',
        actionScriptId: '',
    });

    useEffect(() => {
        if (workspaceId) {
            fetchData();
        }
    }, [workspaceId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [policiesRes, scriptsRes] = await Promise.all([
                csrfFetch(`/api/workspaces/${workspaceId}/patches`),
                csrfFetch(`/api/workspaces/${workspaceId}/scripts`),
            ]);

            if (!policiesRes.ok || !scriptsRes.ok) throw new Error('Failed to load data.');

            const policiesData = await policiesRes.json();
            const scriptsData = await scriptsRes.json();

            setPolicies(policiesData.data || []);
            setScripts(scriptsData.data || []);
        } catch (err: unknown) {
            showError('Load Error', err instanceof Error ? err.message : 'Failed to fetch patch policies.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.name || !formData.targetSoftware || !formData.actionScriptId) {
            showError('Validation Error', 'All fields are required.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/patches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, isEnabled: true }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || 'Failed to create policy.');
            }

            success('Success', 'Patch policy created successfully.');
            setIsCreateOpen(false);
            setFormData({ name: '', targetSoftware: '', actionScriptId: '' });
            fetchData();
        } catch (err: unknown) {
            showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = (id: string) => {
        setConfirmState({
            open: true,
            title: 'Delete Patch Policy',
            message: 'Are you sure you want to delete this patch policy? This action cannot be undone.',
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, open: false }));
                try {
                    const res = await csrfFetch(`/api/workspaces/${workspaceId}/patches/${id}`, {
                        method: 'DELETE',
                    });
                    if (!res.ok) throw new Error('Failed to delete policy.');
                    success('Success', 'Patch policy deleted.');
                    setPolicies(policies.filter(p => p.id !== id));
                } catch (err: unknown) {
                    showError('Delete Error', err instanceof Error ? err.message : 'An error occurred.');
                }
            },
        });
    };

    const requestExecute = (policy: PatchPolicy) => {
        setConfirmState({
            open: true,
            title: 'Deploy Patch',
            message: `Deploy patch "${policy.name}" to ${policy.vulnerableCount} endpoint(s)? This will execute the associated remediation script.`,
            onConfirm: () => { setConfirmState(prev => ({ ...prev, open: false })); handleExecute(policy); },
        });
    };

    const handleExecute = async (policy: PatchPolicy) => {
        setExecutingId(policy.id);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/patches/${policy.id}/execute`, {
                method: 'POST',
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Execution failed.');

            success('Patch Dispatched', data.meta?.message || `Successfully dispatched to ${data.data?.count} endpoints.`);
        } catch (err: unknown) {
            showError('Execution Error', err instanceof Error ? err.message : 'An error occurred during dispatch.');
        } finally {
            setExecutingId(null);
        }
    };

    if (loading) return <PageSpinner text="Loading patch policies…" />;

    return (
        <>
            <ConfirmDialog
                open={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel="Confirm"
                variant="danger"
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
            />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Patch Management</h1>
                    <p className="text-sm text-slate-400 mt-1">Cross-reference installed software and deploy bulk remediation scripts.</p>
                </div>
                <button onClick={() => setIsCreateOpen(true)} className="inline-flex items-center gap-1.5 primary-gradient-btn text-on-primary font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all rounded-full px-6 py-2 text-sm">
                    <Plus className="h-4 w-4" /> New Patch Policy
                </button>
            </div>

            {policies.length === 0 ? (
                <EmptyState
                    icon={<ShieldCheck className="w-16 h-16 text-health-good" />}
                    title="No Patch Policies Configured"
                    description="Create a patch policy to automatically target machines running specific software versions and execute a remediation script."
                    action={{ label: 'Create Policy', onClick: () => setIsCreateOpen(true) }}
                />
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {policies.map((policy, i) => (
                        <div 
                            key={policy.id} 
                            className="bg-surface-container border border-border shadow-sm rounded-xl p-5 flex flex-col justify-between animate-fade-in transition-all hover:border-border/80"
                            style={{ animationDelay: `${i * 25}ms`, animationFillMode: 'both' }}
                        >
                            <div>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl border ${policy.vulnerableCount && policy.vulnerableCount > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-health-good/10 border-health-good/20'}`}>
                                            {policy.vulnerableCount && policy.vulnerableCount > 0 ? (
                                                <ShieldAlert className="w-5 h-5 text-amber-500" />
                                            ) : (
                                                <ShieldCheck className="w-5 h-5 text-health-good" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-on-surface">{policy.name}</h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">Targets: <span className="font-mono text-on-surface bg-surface-container-low px-1.5 py-0.5 rounded border border-border">{policy.targetSoftware}</span></p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(policy.id)} className="btn-ghost h-8 w-8 p-0 text-muted-foreground hover:text-red-400">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="flex flex-col gap-2.5 mb-6">
                                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground p-2.5 bg-surface-container-low rounded-lg border border-border/50">
                                        <Terminal className="h-4 w-4 shrink-0" />
                                        <span className="truncate">Action: <span className="text-on-surface font-medium">{policy.actionScript?.name || 'Unknown Script'}</span></span>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground p-2.5 bg-surface-container-low rounded-lg border border-border/50">
                                        <Server className="h-4 w-4 shrink-0" />
                                        <span>Vulnerable Endpoints: <span className={policy.vulnerableCount && policy.vulnerableCount > 0 ? 'text-amber-500 font-bold' : 'text-health-good font-bold'}>{policy.vulnerableCount || 0}</span></span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-border/60 pt-4">
                                <span className="text-xs text-muted-foreground">Created: {new Date(policy.createdAt).toLocaleDateString()}</span>
                                <button
                                    onClick={() => requestExecute(policy)}
                                    disabled={!policy.vulnerableCount || policy.vulnerableCount === 0 || executingId === policy.id}
                                    className={`btn-primary h-8 px-4 text-xs gap-1.5 transition-all ${policy.vulnerableCount && policy.vulnerableCount > 0 ? 'shadow-primary/20 hover:scale-[1.02]' : 'opacity-50 grayscale hover:scale-100'} `}
                                >
                                    <Play className="h-3 w-3" />
                                    {executingId === policy.id ? 'Deploying...' : 'Deploy Patch Batch'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Policy Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface-container border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 flex justify-between items-start border-b border-border/50 bg-surface-container-low/50">
                            <div>
                                <h2 className="text-lg font-semibold text-on-surface">Create Patch Policy</h2>
                                <p className="text-xs text-muted-foreground mt-1">Define a software vulnerability to hunt for and its remediation script.</p>
                            </div>
                            <button onClick={() => setIsCreateOpen(false)} className="btn-ghost h-8 w-8 p-0 text-muted-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="grid gap-5 p-6 overflow-y-auto max-h-[60vh]">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-on-surface">Policy Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Zero-Day Chrome Refactor"
                                    className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-on-surface">Target Software Match</label>
                                <input
                                    type="text"
                                    value={formData.targetSoftware}
                                    onChange={e => setFormData({ ...formData, targetSoftware: e.target.value })}
                                    placeholder="Google Chrome"
                                    className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm text-on-surface placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all"
                                />
                                <p className="text-[11px] text-muted-foreground leading-relaxed">Agents containing this case-insensitive string in their software inventory will be targeted.</p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-on-surface">Remediation Script</label>
                                {scripts.length === 0 ? (
                                    <div className="text-sm text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">No scripts available. Add a script in the Script Library first.</div>
                                ) : (
                                    <select
                                        className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all appearance-none"
                                        value={formData.actionScriptId}
                                        onChange={e => setFormData({ ...formData, actionScriptId: e.target.value })}
                                    >
                                        <option value="" disabled>Select Script...</option>
                                        {scripts.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.language})</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>

                        <div className="p-5 border-t border-border/50 bg-surface-container-low/50 flex justify-end gap-3">
                            <button type="button" className="btn-secondary h-9 px-4 text-sm" onClick={() => setIsCreateOpen(false)}>Cancel</button>
                            <button type="button" className="btn-primary h-9 px-5 text-sm" onClick={handleCreate} disabled={isSubmitting || !formData.name || !formData.targetSoftware || !formData.actionScriptId}>
                                {isSubmitting ? 'Creating...' : 'Save Policy'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function PatchesPage() {
    return (
        <WorkspaceLayout>
            <Suspense fallback={<PageSpinner />}>
                <PatchPoliciesContent />
            </Suspense>
        </WorkspaceLayout>
    );
}
