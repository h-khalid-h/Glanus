'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { WorkspaceTable } from '@/components/super-admin/WorkspaceTable';
import type { WorkspaceRow } from '@/lib/services/SuperAdminService';

interface WorkspacesData {
    workspaces: WorkspaceRow[];
    meta: { total: number; page: number; limit: number; totalPages: number };
}

function WorkspaceDetailModal({ ws, onClose }: { ws: WorkspaceRow; onClose: () => void }) {
    const fields: [string, string | number | null][] = [
        ['Workspace ID', ws.id],
        ['Slug', ws.slug],
        ['Owner ID', ws.ownerId],
        ['Owner Email', ws.ownerEmail],
        ['Plan', ws.plan],
        ['Status', ws.status],
        ['Members', ws.userCount],
        ['Assets', ws.assetCount],
        ['Agents', ws.agentCount],
        ['Created', ws.createdAt ? new Date(ws.createdAt).toLocaleString() : '—'],
        ['Last Activity', ws.lastActivity ? new Date(ws.lastActivity).toLocaleString() : 'Never'],
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                    <div>
                        <h2 className="text-base font-semibold text-slate-100">{ws.name}</h2>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{ws.id}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Fields */}
                <div className="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-3">
                    {fields.map(([label, value]) => (
                        <div key={label}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</p>
                            <p className="mt-0.5 text-sm text-slate-300 font-mono truncate">
                                {value != null && value !== '' ? String(value) : '—'}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-6 py-4">
                    <a
                        href={`/workspaces?impersonate=${ws.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-500/20"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Workspace
                    </a>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:text-slate-300"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SuperAdminWorkspacesPage() {
    const [data, setData] = useState<WorkspacesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [selectedWs, setSelectedWs] = useState<WorkspaceRow | null>(null);

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchData = useCallback(async (p: number, s: string) => {
        setLoading(true);
        setError(null);
        try {
            const url = new URL('/api/admin/workspaces', window.location.origin);
            url.searchParams.set('page', String(p));
            url.searchParams.set('limit', '20');
            if (s) url.searchParams.set('search', s);

            const res = await fetch(url.toString(), { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load workspaces');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(1, ''); }, [fetchData]);

    const handleSearch = useCallback((value: string) => {
        setSearch(value);
        setPage(1);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => fetchData(1, value), 350);
    }, [fetchData]);

    const handlePageChange = useCallback((newPage: number) => {
        setPage(newPage);
        fetchData(newPage, search);
    }, [fetchData, search]);

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-100">Workspace Management</h1>
                <p className="mt-1 text-sm text-slate-500">Browse, search, and inspect all tenant workspaces</p>
            </div>

            {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
                    {error}
                </div>
            )}

            <WorkspaceTable
                workspaces={data?.workspaces ?? []}
                total={data?.meta.total ?? 0}
                page={page}
                limit={20}
                loading={loading}
                onPageChange={handlePageChange}
                onSearch={handleSearch}
                onViewWorkspace={setSelectedWs}
            />

            {selectedWs && (
                <WorkspaceDetailModal ws={selectedWs} onClose={() => setSelectedWs(null)} />
            )}
        </div>
    );
}
