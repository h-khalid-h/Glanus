'use client';

import { useState, FormEvent } from 'react';
import { X, Server, AlertCircle, Loader2 } from 'lucide-react';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

type AssetType = 'PHYSICAL' | 'DIGITAL';

interface AgentSummary {
    id: string;
    hostname: string;
    platform: string;
    ipAddress: string | null;
    status: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    workspaceId: string;
    agent: AgentSummary;
    onCreated: () => void;
}

/**
 * Suggest a default AssetType based on the reported agent platform.
 * This is a UI convenience only — the server accepts any valid AssetType.
 */
function suggestAssetType(_platform: string): AssetType {
    // Current Asset schema only supports PHYSICAL / DIGITAL. All agent hosts
    // map to PHYSICAL by default. Category refinement happens post-creation.
    return 'PHYSICAL';
}

export default function CreateAssetFromAgentModal({
    open,
    onClose,
    workspaceId,
    agent,
    onCreated,
}: Props) {
    const { success, error: showError } = useToast();
    const [name, setName] = useState(agent.hostname);
    const [assetType, setAssetType] = useState<AssetType>(suggestAssetType(agent.platform));
    const [location, setLocation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!open) return null;

    const offline = agent.status !== 'ONLINE';

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setSubmitting(true);
        try {
            const res = await csrfFetch(
                `/api/workspaces/${workspaceId}/agents/${agent.id}/create-asset`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name.trim() || undefined,
                        assetType,
                        location: location.trim() || undefined,
                    }),
                },
            );
            const data = await res.json();
            if (!res.ok) {
                const message = data?.error?.message || data?.message || 'Failed to create asset';
                if (res.status === 409) {
                    setErrorMessage('This agent is already linked to an asset.');
                } else if (res.status === 403) {
                    setErrorMessage('You do not have permission to create assets.');
                } else {
                    setErrorMessage(message);
                }
                showError('Create Asset Failed', message);
                return;
            }
            success('Asset Created', `Asset "${data.data?.asset?.name ?? name}" is now linked.`);
            onCreated();
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unexpected error';
            setErrorMessage(message);
            showError('Create Asset Failed', message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-asset-title"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Server size={18} className="text-primary" />
                        <h2 id="create-asset-title" className="text-base font-semibold text-foreground">
                            Create Asset from Agent
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-md hover:bg-muted transition text-muted-foreground"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                    {/* Read-only agent metadata */}
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Hostname</span>
                            <span className="font-mono text-foreground">{agent.hostname}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Platform (OS)</span>
                            <span className="text-foreground">{agent.platform}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">IP Address</span>
                            <span className="font-mono text-foreground">{agent.ipAddress ?? '—'}</span>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="asset-name" className="block text-xs font-medium text-foreground mb-1">
                            Asset Name
                        </label>
                        <input
                            id="asset-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            minLength={1}
                            maxLength={200}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                    </div>

                    <div>
                        <label htmlFor="asset-type" className="block text-xs font-medium text-foreground mb-1">
                            Type
                        </label>
                        <select
                            id="asset-type"
                            value={assetType}
                            onChange={(e) => setAssetType(e.target.value as AssetType)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <option value="PHYSICAL">Physical (server, laptop, workstation)</option>
                            <option value="DIGITAL">Digital (VM, container, cloud)</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="asset-location" className="block text-xs font-medium text-foreground mb-1">
                            Location <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <input
                            id="asset-location"
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            maxLength={200}
                            placeholder="e.g. HQ — Server Room 2"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                    </div>

                    {offline && (
                        <div className="flex gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-warning">
                            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                            <span>
                                This agent is currently <strong>{agent.status}</strong>. You can still create an
                                asset — it will link as soon as the agent reconnects.
                            </span>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="flex gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
                            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || name.trim().length === 0}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            {submitting ? 'Creating…' : 'Create Asset'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
