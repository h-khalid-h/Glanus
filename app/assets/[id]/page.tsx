'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, Edit, Trash2, Play, Clock, CheckCircle, XCircle, Monitor } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui';

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

    useEffect(() => {
        const init = async () => {
            const resolvedParams = await params;
            setAssetId(resolvedParams.id);
            await fetchAsset(resolvedParams.id);
            await fetchActions(resolvedParams.id);
        };
        init();
    }, [params]);

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
            const response = await csrfFetch(`/api/dynamic-assets/${assetId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete asset');

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
        <div className="container mx-auto px-4 py-8 max-w-5xl">
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
                <Link href="/assets" className="inline-flex items-center gap-2 text-nerve hover:text-nerve mb-4">
                    <ArrowLeft size={20} />
                    Back to Assets
                </Link>

                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">{asset.category?.icon || '📦'}</span>
                        <div>
                            <h1 className="text-3xl font-bold text-white">{asset.name}</h1>
                            <p className="text-slate-400 mt-1">{asset.category?.name || 'Uncategorized'}</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
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
                            className="flex items-center gap-2 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <Monitor size={16} />
                            {connectingRemote ? 'Connecting…' : 'Connect Remotely'}
                        </button>
                        <Link
                            href={`/assets/${asset.id}/edit`}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-900/30"
                        >
                            <Edit size={16} />
                            Edit
                        </Link>
                        <button type="button"
                            onClick={requestDeleteAsset}
                            className="flex items-center gap-2 px-4 py-2 bg-destructive text-white rounded-lg hover:bg-destructive/80"
                        >
                            <Trash2 size={16} />
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Status */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Status</h2>
                        <div className="flex items-center gap-2">
                            <span
                                className={`px-3 py-1 text-sm font-medium rounded ${asset.status === 'AVAILABLE'
                                    ? 'bg-health-good/15 text-health-good'
                                    : asset.status === 'ASSIGNED'
                                        ? 'bg-nerve/10 text-nerve'
                                        : 'bg-slate-800/50 text-slate-200'
                                    }`}
                            >
                                {asset.status}
                            </span>
                        </div>
                    </div>

                    {/* Field Values */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Details</h2>

                        {!asset.fieldValues || asset.fieldValues.length === 0 ? (
                            <p className="text-slate-500">No additional fields defined</p>
                        ) : (
                            <div className="space-y-4">
                                {asset.fieldValues.map((fv) => (
                                    <div key={fv.id}>
                                        <dt className="text-sm font-medium text-slate-500">
                                            {fv.fieldDefinition.label}
                                        </dt>
                                        <dd className="mt-1 text-sm text-white">
                                            {fv.fieldDefinition.fieldType === 'JSON' ? (
                                                <pre className="bg-slate-900/30 p-3 rounded text-xs font-mono overflow-x-auto">
                                                    {formatFieldValue(fv)}
                                                </pre>
                                            ) : (
                                                formatFieldValue(fv)
                                            )}
                                        </dd>
                                    </div>
                                ))
                                }</div>
                        )}
                    </div>

                    {/* Metadata */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Metadata</h2>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="text-slate-500">Asset ID:</span>
                                <span className="ml-2 font-mono text-white">{asset.id}</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Created:</span>
                                <span className="ml-2 text-white">
                                    {formatDateTime(asset.createdAt)}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500">Updated:</span>
                                <span className="ml-2 text-white">
                                    {formatDateTime(asset.updatedAt)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions Panel */}
                <div className="lg:col-span-1">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6 sticky top-8">
                        <h2 className="text-lg font-semibold text-white mb-4">Actions</h2>

                        {actions.length === 0 ? (
                            <p className="text-sm text-slate-500">No actions available</p>
                        ) : (
                            <div className="space-y-2">
                                {actions.map((action) => (
                                    <button type="button"
                                        key={action.id}
                                        onClick={() => executeAction(action)}
                                        disabled={executingAction === action.id}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left border border-slate-700 rounded-lg hover:bg-slate-900/30 disabled:bg-slate-800/50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <span className="text-2xl">{action.icon || '⚡'}</span>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-white">
                                                {action.label}
                                            </div>
                                            {action.description && (
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {action.description}
                                                </div>
                                            )}
                                        </div>
                                        {executingAction === action.id && (
                                            <Clock size={16} className="animate-spin text-nerve" />
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
                    <div className="rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-white">
                                    Execution Result
                                </h3>
                                <button type="button"
                                    onClick={() => setShowExecutionDialog(false)}
                                    className="text-slate-500 hover:text-slate-300"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Status */}
                                <div className="flex items-center gap-2">
                                    {executionResult.status === 'SUCCESS' ? (
                                        <>
                                            <CheckCircle size={24} className="text-health-good" />
                                            <span className="text-lg font-medium text-health-good">Success</span>
                                        </>
                                    ) : executionResult.status === 'FAILED' ? (
                                        <>
                                            <XCircle size={24} className="text-health-critical" />
                                            <span className="text-lg font-medium text-health-critical">Failed</span>
                                        </>
                                    ) : (
                                        <>
                                            <Clock size={24} className="text-health-warn" />
                                            <span className="text-lg font-medium text-health-warn">Pending</span>
                                        </>
                                    )}
                                </div>

                                {/* Output */}
                                {executionResult.output && (
                                    <div>
                                        <h4 className="text-sm font-medium text-slate-300 mb-2">Output:</h4>
                                        <pre className="bg-slate-900/30 p-4 rounded text-sm font-mono overflow-x-auto">
                                            {typeof executionResult.output === 'string'
                                                ? executionResult.output
                                                : JSON.stringify(executionResult.output, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {/* Error */}
                                {executionResult.error && (
                                    <div>
                                        <h4 className="text-sm font-medium text-health-critical mb-2">Error:</h4>
                                        <div className="bg-health-critical/10 p-4 rounded text-sm text-health-critical">
                                            {executionResult.error}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 flex justify-end">
                                <button type="button"
                                    onClick={() => setShowExecutionDialog(false)}
                                    className="px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
