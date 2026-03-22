'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/ui/EmptyState';
import {
    Wrench, Plus, Calendar, Clock, CheckCircle,
    XCircle, ChevronDown, Filter, Loader2,
} from 'lucide-react';

interface MaintenanceWindow {
    id: string;
    title: string;
    description: string | null;
    type: string;
    scheduledStart: string;
    scheduledEnd: string;
    actualStart: string | null;
    actualEnd: string | null;
    status: string;
    priority: string;
    notes: string | null;
    cost: number | null;
    createdById: string;
    createdAt: string;
    asset: { id: string; name: string; status: string };
}

type StatusFilter = 'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

const statusConfig: Record<string, { color: string; bg: string; icon: typeof Clock }> = {
    scheduled: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Calendar },
    in_progress: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Loader2 },
    completed: { color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle },
    cancelled: { color: 'text-slate-400', bg: 'bg-slate-500/10', icon: XCircle },
};

const priorityColors: Record<string, string> = {
    low: 'text-slate-400 bg-slate-500/10',
    medium: 'text-blue-400 bg-blue-500/10',
    high: 'text-amber-400 bg-amber-500/10',
    critical: 'text-red-400 bg-red-500/10',
};

export default function MaintenancePage() {
    const params = useParams();
    const workspaceId = params?.id as string;
    const { success: toastSuccess, error: toastError } = useToast();

    const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);

    // Create form
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('preventive');
    const [priority, setPriority] = useState('medium');
    const [assetId, setAssetId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Simple asset list for the dropdown
    const [assets, setAssets] = useState<Array<{ id: string; name: string }>>([]);

    const fetchWindows = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const qs = new URLSearchParams({ limit: '100' });
            if (statusFilter !== 'all') qs.set('status', statusFilter);
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/maintenance?${qs}`);
            if (!res.ok) throw new Error('Failed to load maintenance windows');
            const data = await res.json();
            setWindows(data.data?.windows || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [workspaceId, statusFilter]);

    useEffect(() => { fetchWindows(); }, [fetchWindows]);

    useEffect(() => {
        if (!workspaceId) return;
        csrfFetch(`/api/workspaces/${workspaceId}/assets?limit=200`)
            .then(r => r.json())
            .then(d => setAssets(d.data?.assets?.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })) || []))
            .catch(() => { });
    }, [workspaceId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!workspaceId) return;
        setCreating(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/maintenance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description: description || undefined,
                    type,
                    priority,
                    assetId,
                    scheduledStart: new Date(startDate).toISOString(),
                    scheduledEnd: new Date(endDate).toISOString(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || data.error || 'Create failed');
            toastSuccess('Created', 'Maintenance window scheduled.');
            setShowCreate(false);
            setTitle(''); setDescription(''); setAssetId(''); setStartDate(''); setEndDate('');
            fetchWindows();
        } catch (err: unknown) {
            toastError('Create Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setCreating(false);
        }
    };

    const [changingStatus, setChangingStatus] = useState<string | null>(null);

    const handleStatusChange = async (windowId: string, newStatus: string) => {
        setChangingStatus(windowId);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/maintenance?windowId=${windowId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    ...(newStatus === 'in_progress' && { actualStart: new Date().toISOString() }),
                    ...(newStatus === 'completed' && { actualEnd: new Date().toISOString() }),
                }),
            });
            if (!res.ok) throw new Error('Status update failed');
            fetchWindows();
        } catch (err: unknown) {
            toastError('Update Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setChangingStatus(null);
        }
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    if (loading && windows.length === 0) return <PageSpinner text="Loading maintenance…" />;
    if (error && windows.length === 0) return <ErrorState title="Error" description={error} onRetry={fetchWindows} />;

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-nerve/10 flex items-center justify-center">
                        <Wrench className="text-nerve" size={20} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Maintenance</h1>
                        <p className="text-slate-400 text-sm">{windows.length} window(s) • Schedule and track asset maintenance</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="bg-slate-800 border border-slate-700 text-white rounded-lg pl-8 pr-8 py-2 text-sm outline-none appearance-none">
                            <option value="all">All Status</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    <button onClick={() => setShowCreate(!showCreate)} className="btn-primary inline-flex items-center gap-2">
                        <Plus size={16} />
                        Schedule Maintenance
                    </button>
                </div>
            </div>

            {/* Create Form */}
            {showCreate && (
                <form onSubmit={handleCreate} className="card mb-6 space-y-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Calendar size={18} className="text-nerve" />New Maintenance Window</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-300 mb-1">Title *</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="input-field w-full" placeholder="e.g. Quarterly inspection" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-1">Asset *</label>
                            <select value={assetId} onChange={e => setAssetId(e.target.value)} required className="input-field w-full">
                                <option value="">Select asset…</option>
                                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-1">Type</label>
                            <select value={type} onChange={e => setType(e.target.value)} className="input-field w-full">
                                <option value="preventive">Preventive</option>
                                <option value="corrective">Corrective</option>
                                <option value="inspection">Inspection</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-1">Priority</label>
                            <select value={priority} onChange={e => setPriority(e.target.value)} className="input-field w-full">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-1">Scheduled Start *</label>
                            <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required className="input-field w-full" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-1">Scheduled End *</label>
                            <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} required className="input-field w-full" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-300 mb-1">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="input-field w-full" placeholder="Optional notes…" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={creating} className="btn-primary inline-flex items-center gap-2">
                            {creating && <Loader2 size={14} className="animate-spin" />}
                            {creating ? 'Creating…' : 'Create'}
                        </button>
                    </div>
                </form>
            )}

            {/* Maintenance List */}
            {windows.length === 0 ? (
                <EmptyState title="No maintenance windows" description="Schedule your first maintenance window to track asset upkeep." />
            ) : (
                <div className="space-y-3">
                    {windows.map(w => {
                        const sc = statusConfig[w.status] || statusConfig.scheduled;
                        const StatusIcon = sc.icon;
                        return (
                            <div key={w.id} className="card hover:border-nerve/30 transition group">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className={`shrink-0 w-9 h-9 rounded-lg ${sc.bg} flex items-center justify-center mt-0.5`}>
                                            <StatusIcon size={16} className={`${sc.color} ${w.status === 'in_progress' ? 'animate-spin' : ''}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-medium text-foreground truncate">{w.title}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[w.priority] || priorityColors.medium}`}>
                                                    {w.priority}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">{w.type}</span>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                <span className="text-nerve">{w.asset.name}</span> • {formatDate(w.scheduledStart)} → {formatDate(w.scheduledEnd)}
                                            </div>
                                            {w.description && <p className="text-xs text-slate-500 mt-1 truncate">{w.description}</p>}
                                            {w.cost !== null && <span className="text-xs text-slate-500 mt-0.5 inline-block">Cost: ${w.cost.toFixed(2)}</span>}
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-1.5">
                                        {w.status === 'scheduled' && (
                                            <>
                                                <button onClick={() => handleStatusChange(w.id, 'in_progress')} disabled={changingStatus === w.id} className="btn-secondary text-xs px-2 py-1 disabled:opacity-50" title="Start">{changingStatus === w.id ? '…' : 'Start'}</button>
                                                <button onClick={() => handleStatusChange(w.id, 'cancelled')} disabled={changingStatus === w.id} className="btn-secondary text-xs px-2 py-1 text-red-400 hover:text-red-300 disabled:opacity-50" title="Cancel">Cancel</button>
                                            </>
                                        )}
                                        {w.status === 'in_progress' && (
                                            <button onClick={() => handleStatusChange(w.id, 'completed')} disabled={changingStatus === w.id} className="btn-secondary text-xs px-2 py-1 text-green-400 hover:text-green-300 disabled:opacity-50" title="Complete">{changingStatus === w.id ? '…' : 'Complete'}</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}
