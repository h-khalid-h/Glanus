'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import {
    Wrench, Plus, Calendar, Clock, CheckCircle,
    XCircle, ChevronDown, Filter, Loader2, X, AlertTriangle, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

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
    scheduled: { color: 'text-primary', bg: 'bg-primary/15', icon: Calendar },
    in_progress: { color: 'text-nerve', bg: 'bg-nerve/15', icon: Loader2 },
    completed: { color: 'text-health-good', bg: 'bg-health-good/15', icon: CheckCircle },
    cancelled: { color: 'text-muted-foreground', bg: 'bg-muted', icon: XCircle },
};

const getStatusAccentColor = (status: string): string => {
    switch (status) {
        case 'scheduled': return 'hsl(var(--primary))';
        case 'in_progress': return 'hsl(var(--nerve))';
        case 'completed': return 'hsl(var(--health-good))';
        case 'cancelled': return 'hsl(var(--muted-foreground))';
        default: return 'hsl(var(--primary))';
    }
};

const getStatusLabel = (status: string) => {
    switch(status) {
        case 'scheduled': return 'Scheduled';
        case 'in_progress': return 'In Progress';
        case 'completed': return 'Completed';
        case 'cancelled': return 'Cancelled';
        default: return status;
    }
};


const typeColors: Record<string, string> = {
    preventive: 'bg-primary/10 text-primary',
    corrective: 'bg-health-warn/10 text-health-warn',
    inspection: 'bg-health-good/10 text-health-good',
};

const priorityColors: Record<string, { cls: string, icon: any }> = {
    low: { cls: 'text-muted-foreground bg-muted', icon: null },
    medium: { cls: 'text-primary bg-primary/10', icon: null },
    high: { cls: 'text-health-warn bg-health-warn/10', icon: AlertTriangle },
    critical: { cls: 'text-health-critical bg-health-critical/10', icon: AlertCircle },
};

export default function MaintenancePage() {
    const workspaceId = useWorkspaceId();
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
        csrfFetch(`/api/assets?workspaceId=${workspaceId}&limit=200`)
            .then(r => { if (!r.ok) throw new Error('Failed to fetch assets'); return r.json(); })
            .then(d => setAssets(d.data?.assets?.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })) || []))
            .catch(() => { setAssets([]); });
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

    const hasActiveFilters = statusFilter !== 'all';

    return (
        <>
            {/* ── Page header ── */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Maintenance</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {loading ? 'Loading...' : `${windows.length} window${windows.length !== 1 ? 's' : ''} scheduled`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                     <button 
                        onClick={() => setShowCreate(!showCreate)} 
                        className="inline-flex items-center gap-1.5 primary-gradient-btn text-on-primary font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all rounded-full px-6 py-2 text-sm"
                     >
                        {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {showCreate ? 'Cancel' : 'Schedule Maintenance'}
                    </button>
                </div>
            </div>

            {/* ── Filter toolbar ── */}
            <div className="flex flex-wrap gap-3 mb-8 p-3 bg-surface-container rounded-xl shadow-sm border border-slate-800/20">
                 <div className="flex items-center text-sm font-medium text-slate-400 pl-2 pr-1">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                </div>
                
                <div className="w-px h-6 bg-slate-800/40 hidden sm:block self-center mx-1" aria-hidden="true" />
                
                <select 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value as StatusFilter)} 
                    className="bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all py-2 pl-3 pr-8 text-on-surface text-sm outline-none appearance-none"
                >
                    <option value="all">All Statuses</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className="btn-ghost h-8 text-sm text-muted-foreground inline-flex items-center gap-1 px-2"
                    >
                        <X className="h-3.5 w-3.5" />
                        Clear
                    </button>
                )}
            </div>

            {/* Create Form */}
            {showCreate && (
                <form onSubmit={handleCreate} className="bg-surface-container rounded-xl shadow-sm border border-slate-800/20 p-6 mb-8 mt-2 animate-slide-up">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-6 text-on-surface">
                        <Calendar size={18} className="text-primary" />
                        New Maintenance Window
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5 font-medium">Title *</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-surface-container-low border border-slate-700/50 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-all py-2 px-3 text-on-surface text-sm outline-none placeholder:text-slate-500" placeholder="e.g. Quarterly Server Inspection" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5 font-medium">Asset *</label>
                            <select value={assetId} onChange={e => setAssetId(e.target.value)} required className="w-full bg-surface-container-low border border-slate-700/50 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-all py-2 px-3 text-on-surface text-sm outline-none">
                                <option value="">Select asset…</option>
                                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5 font-medium">Type</label>
                            <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-surface-container-low border border-slate-700/50 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-all py-2 px-3 text-on-surface text-sm outline-none">
                                <option value="preventive">Preventive</option>
                                <option value="corrective">Corrective</option>
                                <option value="inspection">Inspection</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5 font-medium">Priority</label>
                            <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-surface-container-low border border-slate-700/50 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-all py-2 px-3 text-on-surface text-sm outline-none">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5 font-medium">Scheduled Start *</label>
                            <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required className="w-full bg-surface-container-low border border-slate-700/50 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-all py-2 px-3 text-on-surface text-sm outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5 font-medium">Scheduled End *</label>
                            <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} required className="w-full bg-surface-container-low border border-slate-700/50 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-all py-2 px-3 text-on-surface text-sm outline-none" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-slate-400 mb-1.5 font-medium">Description</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-surface-container-low border border-slate-700/50 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-all py-2 px-3 text-on-surface text-sm outline-none resize-y placeholder:text-slate-500" placeholder="Optional notes regarding the maintenance window..." />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700/50">
                        <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary px-5 py-2">Cancel</button>
                        <button type="submit" disabled={creating} className="primary-gradient-btn text-on-primary font-bold rounded-lg px-6 py-2 inline-flex items-center gap-2">
                            {creating && <Loader2 size={16} className="animate-spin" />}
                            {creating ? 'Scheduling...' : 'Schedule Maintenance'}
                        </button>
                    </div>
                </form>
            )}

            {/* Maintenance List */}
            {windows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                    <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4 border border-border">
                        <Wrench className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                        {hasActiveFilters ? 'No maintenance matched' : 'No maintenance windows'}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                        {hasActiveFilters
                            ? 'Try adjusting your filters to find what you\'re looking for.'
                            : 'Schedule your first maintenance window to track asset upkeep and repairs.'}
                    </p>
                    {!hasActiveFilters && !showCreate && (
                        <button onClick={() => setShowCreate(true)} className="btn-primary mt-5 inline-flex items-center gap-1.5 text-sm h-9 px-4">
                            <Plus className="h-3.5 w-3.5" />
                            Schedule Maintenance
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {windows.map((w, i) => {
                        const sc = statusConfig[w.status] || statusConfig.scheduled;
                        const StatusIcon = sc.icon;
                        const pConfig = priorityColors[w.priority] || priorityColors.medium;
                        const PriorityIcon = pConfig.icon;
                        
                        return (
                            <div 
                                key={w.id} 
                                className="asset-card animate-fade-in flex flex-col relative bg-surface-container rounded-xl shadow-sm border border-slate-800/20 overflow-hidden hover:border-primary/30 transition-colors"
                                style={{ animationDelay: `${i * 25}ms`, animationFillMode: 'both' }}
                            >
                                {/* Status accent strip */}
                                <div
                                    className="absolute left-0 top-0 bottom-0 w-[4px]"
                                    style={{ background: getStatusAccentColor(w.status) }}
                                />
                                
                                <div className="p-4 flex-1 flex flex-col pl-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className={`badge text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wider rounded-md ${sc.bg} ${sc.color} flex items-center gap-1.5`}>
                                            <StatusIcon size={12} className={w.status === 'in_progress' ? 'animate-spin' : ''} />
                                            {getStatusLabel(w.status)}
                                        </div>
                                        
                                        <span className={`badge text-[10px] font-medium px-2 py-0.5 rounded-md ${typeColors[w.type] || 'bg-slate-800 text-slate-300'} capitalize`}>
                                            {w.type}
                                        </span>
                                    </div>
                                    
                                    <div className="mb-3">
                                        <h3 className="text-base font-semibold text-on-surface line-clamp-1 mb-1">{w.title}</h3>
                                        <div className="flex items-center text-sm text-slate-400 gap-2">
                                            <Wrench size={14} className="text-primary/70" />
                                            <Link href={`/assets/${w.asset.id}`} className="hover:text-primary transition-colors flex-1 truncate">
                                                {w.asset.name}
                                            </Link>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-auto pb-4 border-b border-border/50">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">Schedule</span>
                                            <span className="text-xs text-slate-300">{formatDate(w.scheduledStart)}</span>
                                            <span className="text-xs text-slate-500 mt-0.5">until {formatDate(w.scheduledEnd)}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">Priority</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${pConfig.cls}`}>
                                                    {PriorityIcon ? <PriorityIcon size={10} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                                </span>
                                                <span className="text-xs font-medium capitalize text-slate-300">{w.priority}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-3 flex items-center justify-between">
                                        <div className="text-xs text-slate-500 min-w-0 pr-4">
                                            {w.description ? (
                                                <p className="truncate" title={w.description}>{w.description}</p>
                                            ) : (
                                                <span className="italic opacity-50">No notes provided</span>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {w.status === 'scheduled' && (
                                                <>
                                                    <button onClick={() => handleStatusChange(w.id, 'cancelled')} disabled={changingStatus === w.id} className="btn-ghost h-7 px-2.5 text-xs text-muted-foreground hover:text-health-critical hover:bg-health-critical/10 disabled:opacity-50 transition-colors" title="Cancel">Cancel</button>
                                                    <button onClick={() => handleStatusChange(w.id, 'in_progress')} disabled={changingStatus === w.id} className="btn-secondary h-7 px-3 text-xs bg-surface-container-high hover:bg-primary hover:text-on-primary border-none disabled:opacity-50 transition-all font-medium" title="Start">{changingStatus === w.id ? 'Starting...' : 'Start Job'}</button>
                                                </>
                                            )}
                                            {w.status === 'in_progress' && (
                                                <button onClick={() => handleStatusChange(w.id, 'completed')} disabled={changingStatus === w.id} className="btn-secondary h-7 px-3 text-xs bg-surface-container-high hover:bg-health-good hover:text-black border-none disabled:opacity-50 transition-all font-medium" title="Complete">{changingStatus === w.id ? 'Completing...' : 'Mark Completed'}</button>
                                            )}
                                        </div>
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
