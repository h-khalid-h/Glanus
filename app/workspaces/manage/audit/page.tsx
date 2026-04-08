'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { Search, ChevronDown, ChevronRight, Filter, RefreshCw, FileText, Download, Calendar } from 'lucide-react';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { useToast } from '@/lib/toast';

interface AuditLog {
    id: string;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    metadata: any;
    details: any;
    ipAddress: string | null;
    createdAt: string;
    user: {
        id: string;
        name: string | null;
        email: string;
    } | null;
    asset: {
        id: string;
        name: string | null;
    } | null;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function AuditLogsPage() {
    const workspaceId = useWorkspaceId();

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Filters
    const [page, setPage] = useState(1);
    const [searchAction, setSearchAction] = useState('');
    const [resourceType, setResourceType] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const { success: toastSuccess, error: toastError } = useToast();

    const fetchLogs = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                ...(searchAction && { action: searchAction }),
                ...(resourceType && { resourceType }),
                ...(startDate && { startDate }),
                ...(endDate && { endDate }),
            });

            const res = await csrfFetch(`/api/workspaces/${workspaceId}/audit?${queryParams}`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to fetch audit logs');
            }
            const data = await res.json();
            setLogs(data.data?.logs || data.logs || []);
            setPagination(data.data?.pagination || data.pagination || null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (workspaceId) {
            fetchLogs();
        }
    }, [workspaceId, page, searchAction, resourceType, startDate, endDate]);

    const handleExport = async (format: 'csv' | 'json') => {
        setIsExporting(true);
        try {
            const queryParams = new URLSearchParams({
                format,
                ...(searchAction && { action: searchAction }),
                ...(resourceType && { resourceType }),
                ...(startDate && { startDate }),
                ...(endDate && { endDate }),
            });
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/audit/export?${queryParams}`);
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-logs.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toastSuccess('Export Complete', `Audit logs exported as ${format.toUpperCase()}`);
        } catch {
            toastError('Export Failed', 'Could not export audit logs');
        } finally {
            setIsExporting(false);
        }
    };

    const toggleRow = (id: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedRows(newSet);
    };

    if (isLoading && logs.length === 0) {
        return <SkeletonDashboard />;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Audit Logs</h1>
                    <p className="text-muted-foreground">Enterprise compliance matrix tracking all platform mutations.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleExport('csv')}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 border border-nerve/30 text-nerve rounded-lg hover:bg-nerve/10 transition-colors disabled:opacity-50 text-sm font-medium"
                    >
                        <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
                        Export CSV
                    </button>
                    <button
                        onClick={fetchLogs}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-surface-2 text-white rounded-lg hover:bg-surface-3 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-surface-1 border border-border p-4 rounded-xl flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by action (e.g. workspace.updated)"
                        value={searchAction}
                        onChange={(e) => {
                            setSearchAction(e.target.value);
                            setPage(1);
                        }}
                        className="w-full pl-9 pr-4 py-2 bg-surface-2 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-nerve"
                    />
                </div>
                <div className="w-full sm:w-64 relative flex items-center">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <select
                        value={resourceType}
                        onChange={(e) => {
                            setResourceType(e.target.value);
                            setPage(1);
                        }}
                        className="w-full pl-9 pr-4 py-2 bg-surface-2 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-nerve appearance-none"
                    >
                        <option value="">All Resource Types</option>
                        <option value="Workspace">Workspace</option>
                        <option value="Asset">Asset</option>
                        <option value="Member">Member</option>
                        <option value="AgentConnection">AgentConnection</option>
                        <option value="MdmProfile">MdmProfile</option>
                        <option value="ReflexRule">ReflexRule</option>
                    </select>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative flex items-center">
                        <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="date" value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                            className="pl-9 pr-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-nerve w-40" />
                    </div>
                    <span className="text-muted-foreground text-xs">to</span>
                    <div className="relative flex items-center">
                        <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="date" value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                            className="pl-9 pr-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-nerve w-40" />
                    </div>
                    {(startDate || endDate) && (
                        <button onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                            className="text-xs text-slate-400 hover:text-foreground underline">Clear dates</button>
                    )}
                </div>
            </div>

            {error ? (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl">
                    <p className="font-medium">Error loading audit logs</p>
                    <p className="text-sm opacity-80">{error}</p>
                </div>
            ) : (
                <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border bg-surface-2/50 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                                    <th className="px-6 py-4">Timestamp</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Actor (User)</th>
                                    <th className="px-6 py-4">Resource</th>
                                    <th className="px-6 py-4 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                            No audit logs found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <React.Fragment key={log.id}>
                                            <tr className={`hover:bg-surface-2/30 transition-colors ${expandedRows.has(log.id) ? 'bg-surface-2/10' : ''}`}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-cortex/10 text-cortex border border-cortex/20">
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {log.user ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-foreground">{log.user.name || 'Unknown'}</span>
                                                            <span className="text-xs text-muted-foreground">{log.user.email}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground italic">System Identity</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {log.resourceType ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm text-foreground font-medium">{log.resourceType}</span>
                                                            {log.resourceId && <span className="text-xs text-muted-foreground font-mono">{log.resourceId.slice(0, 8)}...</span>}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => toggleRow(log.id)}
                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-3 transition-colors text-muted-foreground"
                                                    >
                                                        {expandedRows.has(log.id) ? (
                                                            <ChevronDown className="w-4 h-4" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedRows.has(log.id) && (
                                                <tr className="bg-surface-2/20 border-b border-border">
                                                    <td colSpan={5} className="px-6 py-4">
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                            {log.details && Object.keys(log.details).length > 0 && (
                                                                <div className="bg-surface-3/50 border border-border rounded-lg p-4">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FileText className="w-4 h-4 text-muted-foreground" />
                                                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mutation Details</h4>
                                                                    </div>
                                                                    <pre className="text-xs text-muted-foreground overflow-auto max-h-48 scrollbar-thin scrollbar-thumb-surface-4 scrollbar-track-transparent">
                                                                        {JSON.stringify(log.details, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                                <div className="bg-surface-3/50 border border-border rounded-lg p-4">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FileText className="w-4 h-4 text-muted-foreground" />
                                                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">System Metadata</h4>
                                                                    </div>
                                                                    <pre className="text-xs text-muted-foreground overflow-auto max-h-48 scrollbar-thin scrollbar-thumb-surface-4 scrollbar-track-transparent">
                                                                        {JSON.stringify(log.metadata, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                            {/* IP Address and other properties */}
                                                            <div className="col-span-1 lg:col-span-2 flex items-center gap-4 text-xs text-muted-foreground border-t border-border/50 pt-2 mt-2">
                                                                {log.ipAddress && (
                                                                    <div><span className="font-semibold">IP Address:</span> <span className="font-mono">{log.ipAddress}</span></div>
                                                                )}
                                                                {log.asset && (
                                                                    <div><span className="font-semibold">Related Asset:</span> {log.asset.name}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-surface-2/50">
                            <span className="text-sm text-muted-foreground">
                                Showing <span className="font-medium text-white">{((pagination.page - 1) * pagination.limit) + 1}</span> to <span className="font-medium text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium text-white">{pagination.total}</span> entries
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={pagination.page === 1}
                                    className="px-3 py-1.5 text-sm font-medium bg-surface-1 border border-border rounded-md hover:bg-surface-3 transition-colors disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                    disabled={pagination.page === pagination.totalPages}
                                    className="px-3 py-1.5 text-sm font-medium bg-surface-1 border border-border rounded-md hover:bg-surface-3 transition-colors disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
