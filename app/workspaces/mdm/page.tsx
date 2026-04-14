'use client';

import { useState, useEffect } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { Smartphone, Shield, Plus, XCircle, Server, ArrowRightLeft, X } from 'lucide-react';
import { MdmProfileForm } from '@/components/workspace/mdm/MdmProfileForm';
import { ConfirmDialog } from '@/components/ui';

interface MdmProfile {
    id: string;
    name: string;
    description: string;
    platform: string;
    profileType: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configPayload: any;
    _count?: { assignments: number };
}

interface MdmAssignment {
    id: string;
    profileId: string;
    assetId: string;
    status: string;
    appliedAt: string | null;
    errorLog: string | null;
    profile: {
        id: string;
        name: string;
        platform: string;
    };
    asset: {
        id: string;
        name: string;
        serialNumber: string | null;
    };
    createdAt: string;
}

export default function MDMDashboardPage() {
    const workspaceId = useWorkspaceId();
    const { success, error: showError } = useToast();

    const [activeTab, setActiveTab] = useState<'profiles' | 'assignments'>('profiles');
    const [profiles, setProfiles] = useState<MdmProfile[]>([]);
    const [assignments, setAssignments] = useState<MdmAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreatingProfile, setIsCreatingProfile] = useState(false);
    const [confirmState, setConfirmState] = useState<{ open: boolean; profileId: string | null }>({ open: false, profileId: null });
    const [assignModal, setAssignModal] = useState<{ open: boolean; profile: MdmProfile | null; assetId: string }>({ open: false, profile: null, assetId: '' });

    useEffect(() => {
        if (workspaceId) {
            fetchData();
        }
    }, [workspaceId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [profRes, assRes] = await Promise.all([
                csrfFetch(`/api/workspaces/${workspaceId}/mdm/profiles`),
                csrfFetch(`/api/workspaces/${workspaceId}/mdm/assignments`)
            ]);

            if (profRes.ok) {
                const data = await profRes.json();
                setProfiles(data.data || data);
            }
            if (assRes.ok) {
                const data = await assRes.json();
                setAssignments(data.data || data);
            }
        } catch (_err: unknown) {
            showError('Failed to load MDM data');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProfile = async (profileId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/mdm/profiles/${profileId}`, { method: 'DELETE' });
            if (res.ok) {
                success('Profile deleted');
                setProfiles(profiles.filter(p => p.id !== profileId));
            }
        } catch (_err: unknown) {
            showError('Deletion failed');
        }
    };

    const handleAssignProfile = async () => {
        const { profile, assetId } = assignModal;
        if (!profile || !assetId.trim()) return;

        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/mdm/assignments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: profile.id, assetId: assetId.trim() }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Assignment failed');
            }
            success('Profile assigned to asset successfully');
            setAssignModal({ open: false, profile: null, assetId: '' });
            fetchData();
        } catch (err: unknown) {
            showError(err instanceof Error ? err.message : 'Assignment failed');
        }
    };

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
                        <Smartphone className="text-primary h-6 w-6" />
                        Mobile Device Management
                    </h1>
                    <p className="text-muted-foreground mt-1 max-w-2xl">
                        Declare platform-specific configuration profiles and strictly enforce state compliance across physical assets.
                    </p>
                </div>
                {activeTab === 'profiles' && !isCreatingProfile && (
                    <button onClick={() => setIsCreatingProfile(true)} className="btn-primary flex items-center gap-2">
                        <Plus className="w-4 h-4" /> New Profile
                    </button>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-border">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => { setActiveTab('profiles'); setIsCreatingProfile(false); }}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'profiles' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        Configuration Profiles ({profiles.length})
                    </button>
                    <button
                        onClick={() => { setActiveTab('assignments'); setIsCreatingProfile(false); }}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'assignments' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        Deployment Assignments ({assignments.length})
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            {activeTab === 'profiles' && (
                <div className="space-y-4">
                    {isCreatingProfile ? (
                        <div className="bg-surface-1 border border-border rounded-xl p-6">
                            <h2 className="text-lg font-bold text-foreground mb-6">Create MDM Profile</h2>
                            <MdmProfileForm
                                workspaceId={workspaceId}
                                onSuccess={() => { setIsCreatingProfile(false); fetchData(); }}
                                onCancel={() => setIsCreatingProfile(false)}
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {profiles.length === 0 ? (
                                <div className="col-span-full bg-surface-1 border border-border rounded-xl p-12 text-center">
                                    <Shield className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-foreground mb-2">No Profiles Configured</h3>
                                    <p className="text-muted-foreground mb-6">Build declarative configuration states for Windows, macOS, or Linux devices.</p>
                                    <button onClick={() => setIsCreatingProfile(true)} className="btn-primary">Create First Profile</button>
                                </div>
                            ) : (
                                profiles.map(profile => (
                                    <div key={profile.id} className="bg-surface-1 border border-border rounded-xl p-5 hover:border-border transition-colors">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-foreground font-medium flex items-center gap-2">
                                                    {profile.name}
                                                    <span className="text-[10px] bg-muted text-foreground px-2 py-0.5 rounded">{profile.platform}</span>
                                                </h3>
                                                <p className="text-sm text-muted-foreground mt-1">{profile.description}</p>
                                            </div>
                                            <button onClick={() => setConfirmState({ open: true, profileId: profile.id })} className="text-muted-foreground hover:text-destructive">
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                            <div className="bg-background p-3 rounded-xl border border-border/50">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase">Type</p>
                                                <p className="text-sm text-foreground mt-1">{profile.profileType}</p>
                                            </div>
                                            <div className="bg-background p-3 rounded-xl border border-border/50">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase">Active Links</p>
                                                <p className="text-sm text-foreground mt-1">{profile._count?.assignments || 0} Assets</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-end border-t border-border pt-3">
                                            <button onClick={() => setAssignModal({ open: true, profile, assetId: '' })} className="text-primary hover:text-foreground text-sm font-medium transition-colors">
                                                Deploy to Asset &rarr;
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'assignments' && (
                <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
                    {assignments.length === 0 ? (
                        <div className="p-12 text-center">
                            <ArrowRightLeft className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No Active Deployments</h3>
                            <p className="text-muted-foreground">Profiles assigned to your physical assets will appear here outlining their enforcement status.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-background text-muted-foreground uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Profile Name</th>
                                        <th className="px-6 py-4 font-medium">Target Asset</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium">Assigned</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-foreground">
                                    {assignments.map(assign => (
                                        <tr key={assign.id} className="hover:bg-muted/50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-foreground">{assign.profile?.name}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">{assign.profile?.platform}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Server className="w-4 h-4 text-muted-foreground" />
                                                    {assign.asset?.name || 'Unknown Device'}
                                                    {assign.asset?.serialNumber && <span className="text-muted-foreground">#{assign.asset.serialNumber}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${assign.status === 'APPLIED' ? 'bg-success/10 text-success border-success/20' :
                                                    assign.status === 'FAILED' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                                        'bg-amber-500/10 text-warning border-amber-500/20'
                                                    }`}>
                                                    {assign.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {new Date(assign.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            <ConfirmDialog
                open={confirmState.open}
                title="Delete MDM Profile"
                message="Delete this profile? Active assignments will be orphaned."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => {
                    if (confirmState.profileId) handleDeleteProfile(confirmState.profileId);
                    setConfirmState({ open: false, profileId: null });
                }}
                onCancel={() => setConfirmState({ open: false, profileId: null })}
            />

            {assignModal.open && assignModal.profile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAssignModal({ open: false, profile: null, assetId: '' })} />
                    <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface-1 p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="assign-modal-title">
                        <div className="flex items-center justify-between mb-4">
                            <h3 id="assign-modal-title" className="text-base font-semibold text-foreground">Deploy Profile</h3>
                            <button onClick={() => setAssignModal({ open: false, profile: null, assetId: '' })} className="text-muted-foreground hover:text-foreground transition" aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                            Enter the Asset ID to deploy &ldquo;{assignModal.profile.name}&rdquo; to:
                        </p>
                        <input
                            type="text"
                            autoFocus
                            value={assignModal.assetId}
                            onChange={(e) => setAssignModal(prev => ({ ...prev, assetId: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter' && assignModal.assetId.trim()) handleAssignProfile(); }}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary mb-4"
                            placeholder="e.g. asset_01abc..."
                        />
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => setAssignModal({ open: false, profile: null, assetId: '' })} className="rounded-xl border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                                Cancel
                            </button>
                            <button type="button" onClick={handleAssignProfile} disabled={!assignModal.assetId.trim()} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                                Deploy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
