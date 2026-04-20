'use client';
import { useState, useEffect, Suspense } from 'react';

import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { useWorkspace } from '@/lib/workspace/context';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui';
import { ShieldCheck, ShieldAlert, Network, X, Key, Info, Ban, Activity } from 'lucide-react';

interface ZtnaPolicy {
    id: string;
    isEnabled: boolean;
    ipWhitelist: string;
    action: string;
    createdAt: string;
    updatedAt: string;
}

function ZtnaDashboardContent() {
    const { workspace } = useWorkspace();
    const workspaceId = workspace?.id ?? '';
    const { success, error: showError } = useToast();

    // Evaluate active member permission
    const hasAdminAccess = workspace?.userRole === 'ADMIN' || workspace?.userRole === 'OWNER';

    const [policies, setPolicies] = useState<ZtnaPolicy[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<ZtnaPolicy | null>(null);
    const [confirmState, setConfirmState] = useState<{ open: boolean; policyId: string | null }>({ open: false, policyId: null });
    const [formData, setFormData] = useState({
        isEnabled: false,
        ipWhitelist: '',
    });

    useEffect(() => {
        if (workspaceId) {
            checkAccessAndFetch();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    const checkAccessAndFetch = async () => {
        setLoading(true);
        try {
            // Because ZTNA is strictly secured, the GET API requires ADMIN role.
            // If the user lacks clearance, this will 403.
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/ztna`);
            if (!res.ok) {
                if (res.status === 403) {
                    return;
                }
                throw new Error('Failed to load ZTNA policies.');
            }
            const data = await res.json();
            setPolicies(data.data || []);
        } catch (err: unknown) {
            showError('Load Error', err instanceof Error ? err.message : 'Failed to fetch conditional access configuration.');
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (policy: ZtnaPolicy) => {
        setEditingPolicy(policy);
        setFormData({ isEnabled: policy.isEnabled, ipWhitelist: policy.ipWhitelist });
        setIsModalOpen(true);
    };

    const openCreateModal = () => {
        setEditingPolicy(null);
        setFormData({ isEnabled: true, ipWhitelist: '' });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.ipWhitelist.trim()) {
            showError('Validation Error', 'IP Whitelist cannot be empty.');
            return;
        }

        setIsSubmitting(true);
        try {
            const url = editingPolicy
                ? `/api/workspaces/${workspaceId}/ztna/${editingPolicy.id}`
                : `/api/workspaces/${workspaceId}/ztna`;

            const method = editingPolicy ? 'PATCH' : 'POST';

            const res = await csrfFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || 'Failed to save ZTNA policy.');
            }

            success('Success', `Network security policy ${editingPolicy ? 'updated' : 'created'} successfully.`);
            setIsModalOpen(false);
            checkAccessAndFetch();
        } catch (err: unknown) {
            showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDisableOrDelete = async (policyId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/ztna/${policyId}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to permanently delete ZTNA routing configuration.');

            success('Success', 'Zero-Trust Conditional Access configuration permanently removed.');
            checkAccessAndFetch();
        } catch (err: unknown) {
            showError('Delete Error', err instanceof Error ? err.message : 'An error occurred.');
        }
    };

    if (loading) return <PageSpinner />;

    // ZTNA Configuration strictly limited to ADMIN or OWNER
    if (!hasAdminAccess) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-destructive/20 bg-destructive/5">
                <Ban className="h-12 w-12 text-destructive mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground">Only Workspace Administrators can modify Zero-Trust Network boundaries.</p>
            </div>
        );
    }

    const activePolicy = policies.length > 0 ? policies[0] : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Zero-Trust Network Access</h1>
                    <p className="text-sm text-muted-foreground mt-1">Restrict application and telemetry ingress points to authorized origin IPs exclusively.</p>
                </div>
            </div>

            {!activePolicy ? (
                <EmptyState
                    icon={<Network className="w-16 h-16 text-muted-foreground/60 animate-pulse" />}
                    title="No Network IP Perimeters Asserted"
                    description="This workspace is currently exposed to any incoming connections worldwide. Secure it immediately by dictating a strict IP whitelist."
                    action={{ label: 'Configure Boundary', onClick: openCreateModal }}
                />
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    <div className="rounded-xl border border-border bg-surface-1 overflow-hidden shadow-lg">
                        <div className={`p-4 flex items-center gap-3 border-b ${activePolicy.isEnabled ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-border bg-muted/20'}`}>
                            <div className={`p-2 rounded-xl ${activePolicy.isEnabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-muted text-muted-foreground'}`}>
                                {activePolicy.isEnabled ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-lg text-foreground">
                                    {activePolicy.isEnabled ? 'Strict Enforcement Active' : 'ZTNA Enforcement Paused'}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {activePolicy.isEnabled ? 'Connections outside the whitelist will drop with a 403 Forbidden.' : 'Traffic is currently bypassing the IP evaluation lock.'}
                                </p>
                            </div>
                            <Button variant={activePolicy.isEnabled ? 'secondary' : 'primary'} onClick={() => openEditModal(activePolicy)}>
                                Modify
                            </Button>
                        </div>

                        <div className="p-6">
                            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 border-b border-border pb-2 flex items-center gap-2">
                                <Activity size={16} /> Origin Allowlist
                            </h4>

                            <div className="flex flex-wrap gap-2 mb-6">
                                {activePolicy.ipWhitelist.split(',').map((ip, i) => (
                                    <span key={i} className="px-3 py-1 bg-background border border-border rounded-full text-sm font-mono text-emerald-400 flex items-center gap-1">
                                        {ip.trim()}
                                    </span>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-sm">
                                <Info size={16} className="shrink-0" />
                                <p>Ensure your current egress IP is within this list. If you disable your connection without a fallback, you will permanently lose access to the Workspace dashboard until an administrator restores it via database overrides.</p>
                            </div>
                        </div>

                        <div className="bg-background/50 p-4 border-t border-border flex justify-between items-center text-sm text-muted-foreground">
                            <span>Last audited: {new Date(activePolicy.updatedAt).toLocaleDateString()}</span>
                            <button
                                onClick={() => setConfirmState({ open: true, policyId: activePolicy.id })}
                                className="flex items-center gap-1 hover:text-destructive transition"
                            >
                                <X size={14} /> Abolish Boundary
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={confirmState.open}
                title="Delete Conditional Access Policy"
                message="Are you sure you want to completely disable and delete this Conditional Access policy? Your workspace may become vulnerable."
                confirmLabel="Delete Policy"
                variant="danger"
                onConfirm={() => {
                    if (confirmState.policyId) handleDisableOrDelete(confirmState.policyId);
                    setConfirmState({ open: false, policyId: null });
                }}
                onCancel={() => setConfirmState({ open: false, policyId: null })}
            />

            {/* ZTNA Configuration Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-surface-1 border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 flex justify-between items-start border-b border-border">
                            <div className="flex items-center gap-3">
                                <Key className="text-indigo-400" />
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">ZTNA Network Boundary</h2>
                                    <p className="text-xs text-muted-foreground mt-1">Implement strict packet admission protocols.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition p-1">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <label className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border cursor-pointer hover:border-indigo-500/50 transition">
                                <input
                                    type="checkbox"
                                    checked={formData.isEnabled}
                                    onChange={(e) => setFormData(prev => ({ ...prev, isEnabled: e.target.checked }))}
                                    className="w-5 h-5 rounded border-border text-indigo-500 focus:ring-indigo-500 focus:ring-offset-background bg-muted"
                                />
                                <div>
                                    <div className="font-medium text-foreground">Assert Enforcements Locally</div>
                                    <div className="text-xs text-muted-foreground">Enable this logic against incoming Dashboard and Agent APIs.</div>
                                </div>
                            </label>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Authorized IPs / Subnets</label>
                                <textarea
                                    className="w-full bg-background border border-border rounded-xl p-3 text-sm font-mono text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition min-h-[100px]"
                                    placeholder="e.g. 192.168.1.1, 10.0.0.1, 8.8.8.8"
                                    value={formData.ipWhitelist}
                                    onChange={(e) => setFormData(prev => ({ ...prev, ipWhitelist: e.target.value }))}
                                />
                                <p className="text-xs text-muted-foreground">Comma-separate multiple IP addresses.</p>
                            </div>
                        </div>

                        <div className="p-5 border-t border-border bg-background/50 flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave} disabled={isSubmitting || !formData.ipWhitelist.trim()}>
                                {isSubmitting ? 'Syncing...' : 'Deploy Policy'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ZtnaPage() {
    return (
        <WorkspaceLayout>
            <Suspense fallback={<PageSpinner />}>
                <ZtnaDashboardContent />
            </Suspense>
        </WorkspaceLayout>
    );
}
