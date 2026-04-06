'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, Edit, Trash2, Clock, CheckCircle, XCircle, Monitor, Wrench, Calendar } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui';
import { useWorkspace } from '@/lib/workspace/context';

interface AssetFieldValue {
    id: string;
    fieldDefinition: {
        name: string;
        label: string;
        fieldType: string;
    };
    value: string;
}

interface AssetAction {
    id: string;
    label: string;
    slug: string;
    description: string;
    icon: string;
    handlerType: string;
    requiresConfirmation: boolean;
    confirmationMessage: string;
}

interface AssetDetail {
    id: string;
    name: string;
    status: string;
    category: {
        id: string;
        name: string;
        icon: string;
    };
    fieldValues: AssetFieldValue[];
    physicalAsset?: Record<string, any> | null;
    digitalAsset?: Record<string, any> | null;
    createdAt: string;
    updatedAt: string;
}

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { error: toastError, success: toastSuccess } = useToast();
    const router = useRouter();
    const [assetId, setAssetId] = useState<string | null>(null);
    const [asset, setAsset] = useState<AssetDetail | null>(null);
    const [actions, setActions] = useState<AssetAction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Action execution state
    const [executingAction, setExecutingAction] = useState<string | null>(null);
    const [executionResult, setExecutionResult] = useState<{ status: string; output?: React.ReactNode; error?: string } | null>(null);
    const [showExecutionDialog, setShowExecutionDialog] = useState(false);
    const [connectingRemote, setConnectingRemote] = useState(false);
    const { workspace: currentWorkspace } = useWorkspace();

    // Maintenance windows for this asset
    const [maintenanceWindows, setMaintenanceWindows] = useState<Array<{
        id: string; title: string; type: string; status: string;
        priority: string; scheduledStart: string; scheduledEnd: string;
    }>>([]);

    useEffect(() => {
        const init = async () => {
            const resolvedParams = await params;
            setAssetId(resolvedParams.id);
            await fetchAsset(resolvedParams.id);
            await fetchActions(resolvedParams.id);
        };
        init();
    }, [params]);

    // Fetch maintenance windows for this asset
    useEffect(() => {
        if (!assetId || !currentWorkspace?.id) return;
        csrfFetch(`/api/workspaces/${currentWorkspace.id}/maintenance?assetId=${assetId}&limit=10`)
            .then(r => { if (!r.ok) throw new Error('Failed to fetch maintenance windows'); return r.json(); })
            .then(d => setMaintenanceWindows(d.data?.windows || []))
            .catch(() => { setMaintenanceWindows([]); });
    }, [assetId, currentWorkspace?.id]);

    const fetchAsset = async (id: string) => {
        try {
            setLoading(true);
            const response = await csrfFetch(`/api/assets/${id}`);
            if (!response.ok) throw new Error('Failed to fetch asset');
            const data = await response.json();
            setAsset(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const fetchActions = async (id: string) => {
        try {
            const response = await csrfFetch(`/api/assets/${id}/actions`);
            if (!response.ok) return; // No actions available
            const data = await response.json();
            // API may return { data: [...] } or an array directly
            const actionsList = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
            setActions(actionsList);
        } catch (err: unknown) {
            toastError('Error fetching actions', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => { } });

    const executeAction = async (action: AssetAction) => {
        if (action.requiresConfirmation) {
            setConfirmDialog({
                open: true,
                title: 'Execute Action',
                message: action.confirmationMessage || `Execute ${action.label}?`,
                onConfirm: () => {
                    setConfirmDialog(prev => ({ ...prev, open: false }));
                    performAction(action);
                },
            });
            return;
        }
        performAction(action);
    };

    const performAction = async (action: AssetAction) => {

        try {
            setExecutingAction(action.id);
            setShowExecutionDialog(true);
            setExecutionResult(null);

            const response = await csrfFetch(`/api/assets/${assetId}/actions/${action.slug}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parameters: {} }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Action execution failed');
            }

            const result = await response.json();
            setExecutionResult(result);
        } catch (err: unknown) {
            setExecutionResult({
                status: 'FAILED',
                error: err instanceof Error ? err.message : 'An unexpected error occurred',
            });
        } finally {
            setExecutingAction(null);
        }
    };

    const requestDeleteAsset = () => {
        setConfirmDialog({
            open: true,
            title: 'Delete Asset',
            message: 'Are you sure you want to delete this asset? This action cannot be undone.',
            onConfirm: () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                performDeleteAsset();
            },
        });
    };

    const performDeleteAsset = async () => {

        try {
            const response = await csrfFetch(`/api/assets/${assetId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete asset');

            toastSuccess('Asset Deleted', 'Asset successfully moved to recycle bin.');
            router.push('/assets');
        } catch (err: unknown) {
            toastError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
        }
    };

    const formatFieldValue = (fieldValue: AssetFieldValue) => {
        const { value } = fieldValue;
        const { fieldType } = fieldValue.fieldDefinition;

        if (!value) return '-';

        switch (fieldType) {
            case 'BOOLEAN':
                return value === 'true' ? '✓ Yes' : '✗ No';
            case 'DATE': {
                const d = new Date(value);
                return isNaN(d.getTime()) ? value : d.toLocaleDateString();
            }
            case 'JSON':
                try {
                    return JSON.stringify(JSON.parse(value), null, 2);
                } catch {
                    return value;
                }
            default:
                return value;
        }
    };

    if (loading) {
        return <PageSpinner text="Loading asset..." />;
    }

    if (error || !asset) {
        return (
            <ErrorState
                title={error ? 'Failed to load asset' : 'Asset not found'}
                description={error || 'The asset you are looking for does not exist.'}
                onRetry={() => window.location.reload()}
            />
        );
    }

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmLabel="Confirm"
                variant="danger"
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            />
            {/* Header */}
            <div className="mb-6">
                <Link href="/assets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
                    <ArrowLeft size={15} />
                    Back to Assets
                </Link>

                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 border border-border text-2xl">
                            {asset.category?.icon || '📦'}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-semibold text-foreground truncate">{asset.name}</h1>
                            <p className="text-sm text-muted-foreground mt-0.5">{asset.category?.name || 'Uncategorized'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button type="button"
                            onClick={async () => {
                                if (!assetId) return;
                                try {
                                    setConnectingRemote(true);
                                    const res = await csrfFetch('/api/remote/sessions', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ assetId }),
                                    });
                                    if (!res.ok) {
                                        const data = await res.json();
                                        throw new Error(data.error || 'Failed to start session');
                                    }
                                    const session = await res.json();
                                    const sessionId = session.data?.id || session.id;
                                    router.push(`/remote/${sessionId}`);
                                } catch (err: unknown) {
                                    toastError('Remote Connection Failed', err instanceof Error ? err.message : 'Could not start remote session');
                                } finally {
                                    setConnectingRemote(false);
                                }
                            }}
                            disabled={connectingRemote}
                            className="btn-primary inline-flex items-center gap-1.5 h-9 text-sm px-3 disabled:opacity-50"
                        >
                            <Monitor size={14} />
                            {connectingRemote ? 'Connecting…' : 'Connect Remotely'}
                        </button>
                        <Link
                            href={`/assets/${asset.id}/edit`}
                            className="btn-outline inline-flex items-center gap-1.5 h-9 text-sm px-3"
                        >
                            <Edit size={14} />
                            Edit
                        </Link>
                        <button type="button"
                            onClick={requestDeleteAsset}
                            className="btn-danger inline-flex items-center gap-1.5 h-9 text-sm px-3"
                        >
                            <Trash2 size={14} />
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Status */}
                    <div className="detail-panel">
                        <h2 className="detail-panel-title">Status</h2>
                        <div className="flex items-center gap-2">
                            <span
                                className={`badge px-2.5 py-1 text-xs font-medium rounded-lg ${asset.status === 'AVAILABLE'
                                    ? 'bg-health-good/10 text-health-good'
                                    : asset.status === 'ASSIGNED'
                                        ? 'bg-primary/10 text-primary'
                                        : asset.status === 'MAINTENANCE'
                                            ? 'bg-oracle/10 text-oracle'
                                            : asset.status === 'LOST'
                                                ? 'bg-destructive/10 text-destructive'
                                                : 'bg-muted text-muted-foreground'
                                    }`}
                            >
                                {asset.status.charAt(0) + asset.status.slice(1).toLowerCase()}
                            </span>
                        </div>
                    </div>

                    {/* Field Values */}
                    <div className="detail-panel">
                        <h2 className="detail-panel-title">Details</h2>

                        {!asset.fieldValues || asset.fieldValues.length === 0 ? (
                            <p className="text-sm text-muted-foreground/70">No additional fields defined</p>
                        ) : (
                            <div className="space-y-3.5">
                                {asset.fieldValues.map((fv) => (
                                    <div key={fv.id}>
                                        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                            {fv.fieldDefinition.label}
                                        </dt>
                                        <dd className="text-sm text-foreground">
                                            {fv.fieldDefinition.fieldType === 'JSON' ? (
                                                <pre className="bg-surface-2 border border-border p-3 rounded-lg text-xs font-mono overflow-x-auto scrollbar-thin">
                                                    {formatFieldValue(fv)}
                                                </pre>
                                            ) : (
                                                formatFieldValue(fv)
                                            )}
                                        </dd>
                                    </div>
                                ))}

                                {/* Physical Asset Details */}
                                {asset.physicalAsset && (
                                    <div className="border-t border-border/60 pt-4 mt-4">
                                        <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Hardware Specifications</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.entries(asset.physicalAsset).map(([key, val]) => {
                                                if (!val || key === 'id' || key === 'assetId' || key === 'createdAt' || key === 'updatedAt') return null;
                                                return (
                                                    <div key={key}>
                                                        <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                                                        <dd className="mt-0.5 text-sm text-foreground">{String(val)}</dd>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Digital Asset Details */}
                                {asset.digitalAsset && (
                                    <div className="border-t border-border/60 pt-4 mt-4">
                                        <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Software &amp; License Metrics</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.entries(asset.digitalAsset).map(([key, val]) => {
                                                if (!val || key === 'id' || key === 'assetId' || key === 'createdAt' || key === 'updatedAt') return null;
                                                let displayVal = String(val);
                                                if (key === 'monthlyRecurringCost') displayVal = `$${Number(val).toFixed(2)}`;
                                                if (key === 'renewalDate' && val) displayVal = new Date(val as string).toLocaleDateString();
                                                return (
                                                    <div key={key}>
                                                        <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                                                        <dd className="mt-0.5 text-sm text-foreground">{displayVal}</dd>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Metadata */}
                    <div className="detail-panel">
                        <h2 className="detail-panel-title">Metadata</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div>
                                <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Asset ID</dt>
                                <dd className="font-mono text-xs text-foreground bg-surface-2 border border-border px-2 py-1 rounded-md truncate">{asset.id}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Created</dt>
                                <dd className="text-foreground">{formatDateTime(asset.createdAt)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Last Updated</dt>
                                <dd className="text-foreground">{formatDateTime(asset.updatedAt)}</dd>
                            </div>
                        </div>
                    </div>

                    {/* Maintenance Windows */}
                    {maintenanceWindows.length > 0 && (
                        <div className="detail-panel">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
                                <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                    <Wrench size={14} className="text-primary" />
                                    Maintenance
                                </h2>
                                {currentWorkspace?.id && (
                                    <Link href={`/workspaces/${currentWorkspace.id}/maintenance`} className="text-xs text-primary hover:underline">
                                        View All →
                                    </Link>
                                )}
                            </div>
                            <div className="space-y-2.5">
                                {maintenanceWindows.map(w => (
                                    <div key={w.id} className="flex items-center gap-2.5 text-sm py-1">
                                        <Calendar size={13} className={w.status === 'completed' ? 'text-health-good' : w.status === 'in_progress' ? 'text-oracle' : 'text-primary'} />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-foreground font-medium truncate block text-sm">{w.title}</span>
                                            <span className="text-xs text-muted-foreground">{new Date(w.scheduledStart).toLocaleDateString()} · {w.type}</span>
                                        </div>
                                        <span className={`badge text-[10px] px-1.5 py-0.5 rounded-md ${w.status === 'completed' ? 'bg-health-good/10 text-health-good' :
                                            w.status === 'in_progress' ? 'bg-oracle/10 text-oracle' :
                                                w.status === 'cancelled' ? 'bg-muted text-muted-foreground' :
                                                    'bg-primary/10 text-primary'
                                            }`}>{w.status.replace('_', ' ')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions Panel */}
                <div className="lg:col-span-1">
                    <div className="detail-panel sticky top-20">
                        <h2 className="detail-panel-title">Actions</h2>

                        {actions.length === 0 ? (
                            <p className="text-sm text-muted-foreground/70">No actions available</p>
                        ) : (
                            <div className="space-y-1.5">
                                {actions.map((action) => (
                                    <button type="button"
                                        key={action.id}
                                        onClick={() => executeAction(action)}
                                        disabled={executingAction === action.id}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg border border-border hover:bg-surface-2 hover:border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                                    >
                                        <span className="text-xl shrink-0">{action.icon || '⚡'}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-foreground">
                                                {action.label}
                                            </div>
                                            {action.description && (
                                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                    {action.description}
                                                </div>
                                            )}
                                        </div>
                                        {executingAction === action.id && (
                                            <Clock size={14} className="animate-spin text-primary shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Execution Result Dialog */}
            {showExecutionDialog && executionResult && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="detail-panel max-w-2xl w-full max-h-[80vh] overflow-auto animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-foreground">Execution Result</h3>
                            <button type="button"
                                onClick={() => setShowExecutionDialog(false)}
                                className="btn-ghost h-7 w-7 p-0 rounded-lg text-muted-foreground"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Status */}
                            <div className="flex items-center gap-2">
                                {executionResult.status === 'SUCCESS' ? (
                                    <>
                                        <CheckCircle size={18} className="text-health-good" />
                                        <span className="text-sm font-medium text-health-good">Success</span>
                                    </>
                                ) : executionResult.status === 'FAILED' ? (
                                    <>
                                        <XCircle size={18} className="text-destructive" />
                                        <span className="text-sm font-medium text-destructive">Failed</span>
                                    </>
                                ) : (
                                    <>
                                        <Clock size={18} className="text-oracle" />
                                        <span className="text-sm font-medium text-oracle">Pending</span>
                                    </>
                                )}
                            </div>

                            {/* Output */}
                            {executionResult.output && (
                                <div>
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Output</h4>
                                    <pre className="bg-surface-2 border border-border p-3 rounded-lg text-xs font-mono overflow-x-auto scrollbar-thin">
                                        {typeof executionResult.output === 'string'
                                            ? executionResult.output
                                            : JSON.stringify(executionResult.output, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* Error */}
                            {executionResult.error && (
                                <div>
                                    <h4 className="text-xs font-semibold text-destructive/80 uppercase tracking-wide mb-2">Error</h4>
                                    <div className="bg-destructive/5 border border-destructive/20 p-3 rounded-lg text-sm text-destructive">
                                        {executionResult.error}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button type="button"
                                onClick={() => setShowExecutionDialog(false)}
                                className="btn-primary h-9 text-sm px-4"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
