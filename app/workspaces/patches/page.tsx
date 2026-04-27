'use client';
import { useState, useEffect, Suspense, useMemo } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { ConfirmDialog } from '@/components/ui';
import {
    ShieldAlert, Plus, ShieldCheck, Play, Server, Terminal, Trash2, X,
    Filter, Power, Loader2, Package, Target, Activity, FileCode2,
} from 'lucide-react';

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

type StatusFilter = 'all' | 'vulnerable' | 'clean' | 'disabled';

function PatchPoliciesContent() {
    const workspaceId = useWorkspaceId();
    const { success, error: showError } = useToast();

    const [policies, setPolicies] = useState<PatchPolicy[]>([]);
    const [scripts, setScripts] = useState<Script[]>([]);
    const [loading, setLoading] = useState(true);
    const [executingId, setExecutingId] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const handleToggleEnabled = async (policy: PatchPolicy) => {
        setTogglingId(policy.id);
        const next = !policy.isEnabled;
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/patches/${policy.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: next }),
            });
            if (!res.ok) throw new Error('Failed to update policy.');
            setPolicies(prev => prev.map(p => (p.id === policy.id ? { ...p, isEnabled: next } : p)));
            success(next ? 'Policy Enabled' : 'Policy Paused', `"${policy.name}" is now ${next ? 'actively scanning' : 'paused'}.`);
        } catch (err: unknown) {
            showError('Update Error', err instanceof Error ? err.message : 'Could not toggle policy.');
        } finally {
            setTogglingId(null);
        }
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

    // Derived stats
    const stats = useMemo(() => {
        const total = policies.length;
        const active = policies.filter(p => p.isEnabled).length;
        const vulnerable = policies.filter(p => (p.vulnerableCount ?? 0) > 0).length;
        const exposure = policies.reduce((acc, p) => acc + (p.vulnerableCount ?? 0), 0);
        return { total, active, vulnerable, exposure };
    }, [policies]);

    const filteredPolicies = useMemo(() => {
        switch (statusFilter) {
            case 'vulnerable':
                return policies.filter(p => (p.vulnerableCount ?? 0) > 0);
            case 'clean':
                return policies.filter(p => (p.vulnerableCount ?? 0) === 0 && p.isEnabled);
            case 'disabled':
                return policies.filter(p => !p.isEnabled);
            default:
                return policies;
        }
    }, [policies, statusFilter]);

    const hasActiveFilter = statusFilter !== 'all';

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

            {/* ── Page header ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Patch Management</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Cross-reference installed software and deploy bulk remediation scripts.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="inline-flex items-center gap-1.5 primary-gradient-btn text-on-primary font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all rounded-full px-6 py-2 text-sm"
                >
                    <Plus className="h-4 w-4" /> New Patch Policy
                </button>
            </div>

            {/* ── Stats strip ── */}
            {policies.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    <StatCard
                        icon={<Package className="h-4 w-4" />}
                        label="Total Policies"
                        value={stats.total}
                        tone="neutral"
                    />
                    <StatCard
                        icon={<Activity className="h-4 w-4" />}
                        label="Active"
                        value={stats.active}
                        hint={stats.active < stats.total ? `${stats.total - stats.active} paused` : 'All enabled'}
                        tone="good"
                    />
                    <StatCard
                        icon={<Target className="h-4 w-4" />}
                        label="Vulnerable Policies"
                        value={stats.vulnerable}
                        hint={stats.vulnerable === 0 ? 'No matches' : 'Need attention'}
                        tone={stats.vulnerable > 0 ? 'warn' : 'good'}
                    />
                    <StatCard
                        icon={<ShieldAlert className="h-4 w-4" />}
                        label="Exposed Endpoints"
                        value={stats.exposure}
                        hint={stats.exposure === 0 ? 'Fleet clean' : 'Pending remediation'}
                        tone={stats.exposure > 0 ? 'danger' : 'good'}
                    />
                </div>
            )}

            {/* ── Filter toolbar ── */}
            {policies.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6 p-2 bg-surface-container rounded-xl shadow-sm border border-border/40">
                    <div className="flex items-center text-sm font-medium text-muted-foreground pl-2 pr-1">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                    </div>
                    <div className="w-px h-6 bg-muted/40 hidden sm:block self-center mx-1" aria-hidden="true" />
                    <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
                        All <span className="opacity-60 ml-1">{stats.total}</span>
                    </FilterChip>
                    <FilterChip active={statusFilter === 'vulnerable'} onClick={() => setStatusFilter('vulnerable')} tone="warn">
                        Vulnerable <span className="opacity-70 ml-1">{stats.vulnerable}</span>
                    </FilterChip>
                    <FilterChip active={statusFilter === 'clean'} onClick={() => setStatusFilter('clean')} tone="good">
                        Clean <span className="opacity-70 ml-1">{stats.active - stats.vulnerable}</span>
                    </FilterChip>
                    <FilterChip active={statusFilter === 'disabled'} onClick={() => setStatusFilter('disabled')} tone="muted">
                        Paused <span className="opacity-70 ml-1">{stats.total - stats.active}</span>
                    </FilterChip>
                    {hasActiveFilter && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className="btn-ghost h-8 text-sm text-muted-foreground inline-flex items-center gap-1 px-2 ml-auto"
                        >
                            <X className="h-3.5 w-3.5" />
                            Clear
                        </button>
                    )}
                </div>
            )}

            {/* ── List ── */}
            {policies.length === 0 ? (
                <EmptyState
                    icon={<ShieldCheck className="w-16 h-16 text-health-good" />}
                    title="No Patch Policies Configured"
                    description="Create a patch policy to automatically target machines running specific software versions and execute a remediation script."
                    action={{ label: 'Create Policy', onClick: () => setIsCreateOpen(true) }}
                />
            ) : filteredPolicies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center mb-4 border border-border">
                        <Filter className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    <h3 className="text-sm font-semibold text-on-surface">No policies match this filter</h3>
                    <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                        Try switching back to <span className="text-on-surface font-medium">All</span> or adjusting the filter.
                    </p>
                    <button
                        onClick={() => setStatusFilter('all')}
                        className="btn-secondary mt-5 inline-flex items-center gap-1.5 text-sm h-9 px-4"
                    >
                        Show all policies
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {filteredPolicies.map((policy, i) => {
                        const vulnCount = policy.vulnerableCount ?? 0;
                        const severity: 'danger' | 'warn' | 'good' | 'muted' = !policy.isEnabled
                            ? 'muted'
                            : vulnCount >= 10
                                ? 'danger'
                                : vulnCount > 0
                                    ? 'warn'
                                    : 'good';

                        const accent: Record<typeof severity, string> = {
                            danger: 'bg-destructive',
                            warn: 'bg-amber-500',
                            good: 'bg-health-good',
                            muted: 'bg-muted-foreground/40',
                        };

                        const iconBox: Record<typeof severity, string> = {
                            danger: 'bg-destructive/10 border-destructive/20 text-destructive',
                            warn: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
                            good: 'bg-health-good/10 border-health-good/20 text-health-good',
                            muted: 'bg-surface-container-low border-border text-muted-foreground',
                        };

                        return (
                            <div
                                key={policy.id}
                                className="relative bg-surface-container border border-border/50 shadow-sm rounded-xl overflow-hidden flex flex-col animate-fade-in transition-all hover:border-border hover:shadow-md"
                                style={{ animationDelay: `${i * 25}ms`, animationFillMode: 'both' }}
                            >
                                {/* Severity accent strip */}
                                <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${accent[severity]}`} aria-hidden="true" />

                                <div className="p-5 pl-6 flex-1 flex flex-col">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className={`p-2.5 rounded-xl border shrink-0 ${iconBox[severity]}`}>
                                                {severity === 'danger' || severity === 'warn' ? (
                                                    <ShieldAlert className="w-5 h-5" />
                                                ) : severity === 'muted' ? (
                                                    <Power className="w-5 h-5" />
                                                ) : (
                                                    <ShieldCheck className="w-5 h-5" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-semibold text-on-surface truncate">{policy.name}</h3>
                                                    {!policy.isEnabled && (
                                                        <span className="badge text-[10px] px-1.5 h-4 bg-surface-container-low text-muted-foreground border border-border">
                                                            PAUSED
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                                                    <Target className="h-3 w-3 shrink-0" />
                                                    <span>Matches</span>
                                                    <span className="font-mono text-on-surface bg-surface-container-low px-1.5 py-0.5 rounded border border-border truncate max-w-[220px]">
                                                        {policy.targetSoftware}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <ToggleSwitch
                                                checked={policy.isEnabled}
                                                loading={togglingId === policy.id}
                                                onChange={() => handleToggleEnabled(policy)}
                                                ariaLabel={policy.isEnabled ? 'Pause policy' : 'Enable policy'}
                                            />
                                            <button
                                                onClick={() => handleDelete(policy.id)}
                                                className="btn-ghost h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                aria-label="Delete policy"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Metric tiles */}
                                    <div className="grid grid-cols-2 gap-2.5 mb-4">
                                        <div className="p-3 bg-surface-container-low rounded-xl border border-border/50 flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                                                <Server className="h-3 w-3" />
                                                Vulnerable
                                            </div>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className={`text-2xl font-semibold tabular-nums ${
                                                    severity === 'danger' ? 'text-destructive'
                                                    : severity === 'warn' ? 'text-amber-500'
                                                    : 'text-health-good'
                                                }`}>
                                                    {vulnCount}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {vulnCount === 1 ? 'endpoint' : 'endpoints'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-surface-container-low rounded-xl border border-border/50 flex flex-col gap-1 min-w-0">
                                            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                                                <Terminal className="h-3 w-3" />
                                                Remediation
                                            </div>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileCode2 className="h-4 w-4 text-primary shrink-0" />
                                                <span className="text-sm text-on-surface font-medium truncate">
                                                    {policy.actionScript?.name || 'Unknown Script'}
                                                </span>
                                                {policy.actionScript?.language && (
                                                    <span className="badge text-[9px] px-1.5 h-4 bg-primary/10 text-primary border border-primary/20 uppercase shrink-0">
                                                        {policy.actionScript.language}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between border-t border-border/60 px-5 pl-6 py-3 bg-surface-container-low/40">
                                    <span className="text-xs text-muted-foreground">
                                        Created {new Date(policy.createdAt).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric',
                                        })}
                                    </span>
                                    <button
                                        onClick={() => requestExecute(policy)}
                                        disabled={vulnCount === 0 || !policy.isEnabled || executingId === policy.id}
                                        className={`btn-primary h-8 px-4 text-xs gap-1.5 transition-all ${
                                            vulnCount > 0 && policy.isEnabled
                                                ? 'shadow-primary/20 hover:scale-[1.02]'
                                                : 'opacity-50 grayscale hover:scale-100'
                                        }`}
                                    >
                                        {executingId === policy.id ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Deploying…
                                            </>
                                        ) : (
                                            <>
                                                <Play className="h-3 w-3" />
                                                Deploy Patch{vulnCount > 0 ? ` (${vulnCount})` : ''}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Create Policy Modal ── */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface-container border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 flex justify-between items-start border-b border-border/50 bg-surface-container-low/50">
                            <div>
                                <h2 className="text-lg font-semibold text-on-surface">Create Patch Policy</h2>
                                <p className="text-xs text-muted-foreground mt-1">Define a software vulnerability to hunt for and its remediation script.</p>
                            </div>
                            <button onClick={() => setIsCreateOpen(false)} className="btn-ghost h-8 w-8 p-0 text-muted-foreground" aria-label="Close">
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
                                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-on-surface">Target Software Match</label>
                                <input
                                    type="text"
                                    value={formData.targetSoftware}
                                    onChange={e => setFormData({ ...formData, targetSoftware: e.target.value })}
                                    placeholder="Google Chrome"
                                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all"
                                />
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Agents containing this case-insensitive string in their software inventory will be targeted.
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-on-surface">Remediation Script</label>
                                {scripts.length === 0 ? (
                                    <div className="text-sm text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                                        No scripts available. Add a script in the Script Library first.
                                    </div>
                                ) : (
                                    <select
                                        className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all appearance-none"
                                        value={formData.actionScriptId}
                                        onChange={e => setFormData({ ...formData, actionScriptId: e.target.value })}
                                    >
                                        <option value="" disabled>Select Script…</option>
                                        {scripts.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.language})</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>

                        <div className="p-5 border-t border-border/50 bg-surface-container-low/50 flex justify-end gap-3">
                            <button type="button" className="btn-secondary h-9 px-4 text-sm" onClick={() => setIsCreateOpen(false)}>Cancel</button>
                            <button
                                type="button"
                                className="btn-primary h-9 px-5 text-sm inline-flex items-center gap-2"
                                onClick={handleCreate}
                                disabled={isSubmitting || !formData.name || !formData.targetSoftware || !formData.actionScriptId}
                            >
                                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                {isSubmitting ? 'Creating…' : 'Save Policy'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/* ────────────────────────────────────────────────────────── */
/* Internal sub-components                                    */
/* ────────────────────────────────────────────────────────── */

function StatCard({
    icon,
    label,
    value,
    hint,
    tone,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    hint?: string;
    tone: 'neutral' | 'good' | 'warn' | 'danger';
}) {
    const toneStyles: Record<typeof tone, { value: string; icon: string }> = {
        neutral: { value: 'text-on-surface', icon: 'bg-surface-container-low text-muted-foreground border-border' },
        good: { value: 'text-health-good', icon: 'bg-health-good/10 text-health-good border-health-good/20' },
        warn: { value: 'text-amber-500', icon: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
        danger: { value: 'text-destructive', icon: 'bg-destructive/10 text-destructive border-destructive/20' },
    };
    const t = toneStyles[tone];
    return (
        <div className="bg-surface-container border border-border/40 shadow-sm rounded-xl p-4 flex items-center gap-3 animate-fade-in">
            <div className={`p-2 rounded-lg border shrink-0 ${t.icon}`}>{icon}</div>
            <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
                <div className="flex items-baseline gap-2">
                    <div className={`text-xl font-semibold tabular-nums ${t.value}`}>{value}</div>
                    {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
                </div>
            </div>
        </div>
    );
}

function FilterChip({
    active,
    onClick,
    children,
    tone = 'neutral',
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    tone?: 'neutral' | 'good' | 'warn' | 'muted';
}) {
    const activeStyles: Record<typeof tone, string> = {
        neutral: 'bg-primary/15 text-primary border-primary/30',
        good: 'bg-health-good/15 text-health-good border-health-good/30',
        warn: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
        muted: 'bg-surface-container-highest text-on-surface border-border',
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center h-8 px-3 rounded-lg text-sm font-medium border transition-all ${
                active
                    ? activeStyles[tone]
                    : 'bg-surface-container-low text-muted-foreground border-transparent hover:text-on-surface hover:bg-surface-container-highest'
            }`}
        >
            {children}
        </button>
    );
}

function ToggleSwitch({
    checked,
    onChange,
    loading,
    ariaLabel,
}: {
    checked: boolean;
    onChange: () => void;
    loading?: boolean;
    ariaLabel: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={loading}
            onClick={onChange}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container disabled:opacity-60 ${
                checked ? 'bg-primary' : 'bg-surface-container-highest border border-border'
            }`}
        >
            <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                    checked ? 'translate-x-5' : 'translate-x-0.5'
                }`}
            >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            </span>
        </button>
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
