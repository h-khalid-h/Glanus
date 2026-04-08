'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ASSET_STATUSES } from '@/lib/constants/assetConstants';
import { ConfirmDialog } from '@/components/ui';
import { useWorkspace } from '@/lib/workspace/context';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import { Search, Upload, Plus, Trash2, ChevronLeft, ChevronRight, X, MapPin, UserCircle, CheckSquare } from 'lucide-react';

interface AssetCategory {
    id: string;
    name: string;
    description: string | null;
    icon: string;
}

interface Asset {
    id: string;
    assetType: string;
    name: string;
    categoryId: string;
    category?: AssetCategory;
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    status: string;
    location?: string;
    assignedTo?: {
        id: string;
        name: string;
        email: string;
    };
    createdAt: string;
}

interface PaginationData {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function AssetsPage() {
    const { error: showError } = useToast();
    const _router = useRouter();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [categories, setCategories] = useState<AssetCategory[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });
    const { workspace } = useWorkspace();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [assetType, setAssetType] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [status, setStatus] = useState('');
    const [assignmentFilter, _setAssignmentFilter] = useState('');



    // Bulk selection state
    const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
    const [showBulkActions, setShowBulkActions] = useState(false);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);

    const statuses = ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED', 'LOST'];

    const fetchCategories = useCallback(async () => {
        if (!workspace?.id) return;
        try {
            const response = await csrfFetch(`/api/assets/categories?workspaceId=${workspace.id}`);
            if (response.ok) {
                const data = await response.json();
                setCategories(data.data || []);
            }
        } catch (err) {
            console.error('Failed to load categories', err);
        }
    }, [workspace?.id]);

    const fetchAssets = useCallback(async (page: number = 1) => {
        if (!workspace?.id) return;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
                workspaceId: workspace.id,
            });

            if (debouncedSearch) params.set('search', debouncedSearch);
            if (assetType) params.set('assetType', assetType);
            if (categoryId) params.set('categoryId', categoryId);
            if (status) params.set('status', status);
            if (assignmentFilter) params.set('assignedTo', assignmentFilter);

            // Append timestamp to bust any Next.js aggressive caching across tenant boundaries
            params.set('_t', Date.now().toString());

            const response = await csrfFetch(`/api/assets?${params}`);
            if (!response.ok) throw new Error('Failed to fetch assets');

            const result = await response.json();
            const responseData = result.data || {};
            setAssets(responseData.assets || []);
            if (responseData.pagination) {
                setPagination(responseData.pagination);
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
            showError('Error fetching assets:', msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [workspace?.id, debouncedSearch, assetType, categoryId, status, assignmentFilter, pagination.limit]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        fetchAssets();
    }, [fetchAssets]);

    const handleSearch = (value: string) => {
        setSearch(value);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'AVAILABLE':
                return 'bg-health-good/15 text-health-good';
            case 'ASSIGNED':
                return 'bg-nerve/10 text-nerve';
            case 'MAINTENANCE':
                return 'bg-health-warn/15 text-health-warn';
            case 'RETIRED':
                return 'bg-muted text-muted-foreground';
            case 'LOST':
                return 'bg-health-critical/15 text-health-critical';
            default:
                return 'bg-muted text-muted-foreground';
        }
    };

    const getStatusAccentColor = (status: string): string => {
        switch (status) {
            case 'AVAILABLE': return 'hsl(var(--health-good))';
            case 'ASSIGNED':  return 'hsl(var(--nerve))';
            case 'MAINTENANCE': return 'hsl(var(--oracle))';
            case 'LOST': return 'hsl(var(--health-critical))';
            default: return 'hsl(var(--health-unknown))';
        }
    };

    const getTypeStyle = (type: string) => {
        switch (type) {
            case 'PHYSICAL': return { cls: 'bg-nerve/10 text-nerve', label: 'Physical' };
            case 'DIGITAL':  return { cls: 'bg-oracle/10 text-oracle', label: 'Digital' };
            case 'DYNAMIC':  return { cls: 'bg-cortex/10 text-cortex', label: 'Dynamic' };
            default: return { cls: 'bg-muted text-muted-foreground', label: type };
        }
    };

    const getStatusLabel = (status: string) => {
        const stat = Object.values(ASSET_STATUSES).find(s => s.value === status);
        return stat?.label || status;
    };

    // Bulk selection handlers
    const toggleAssetSelection = (assetId: string) => {
        const newSelection = new Set(selectedAssets);
        if (newSelection.has(assetId)) {
            newSelection.delete(assetId);
        } else {
            newSelection.add(assetId);
        }
        setSelectedAssets(newSelection);
        setShowBulkActions(newSelection.size > 0);
    };

    const toggleSelectAll = () => {
        if (selectedAssets.size === assets.length) {
            setSelectedAssets(new Set());
            setShowBulkActions(false);
        } else {
            setSelectedAssets(new Set(assets.map(a => a.id)));
            setShowBulkActions(true);
        }
    };

    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
    const [bulkStatusTarget, setBulkStatusTarget] = useState('');

    const handleBulkDelete = async () => {
        setShowBulkDeleteConfirm(false);
        if (!workspace?.id) return;

        setBulkActionLoading(true);
        try {
            const response = await csrfFetch(`/api/workspaces/${workspace.id}/assets/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', assetIds: Array.from(selectedAssets) }),
            });

            if (!response.ok) throw new Error('Bulk delete failed');

            const _result = await response.json();
            setSelectedAssets(new Set());
            setShowBulkActions(false);
            fetchAssets(pagination.page);
        } catch (error: unknown) {
            showError('Bulk delete error:', error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkStatusChange = async (newStatus: string) => {
        if (!workspace?.id || !newStatus) return;

        setBulkActionLoading(true);
        try {
            const response = await csrfFetch(`/api/workspaces/${workspace.id}/assets/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_status', assetIds: Array.from(selectedAssets), payload: { status: newStatus } }),
            });

            if (!response.ok) throw new Error('Bulk status update failed');

            setSelectedAssets(new Set());
            setShowBulkActions(false);
            setBulkStatusTarget('');
            fetchAssets(pagination.page);
        } catch (error: unknown) {
            showError('Bulk status error:', error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkExport = async () => {
        if (!workspace?.id) return;
        window.open(`/api/workspaces/${workspace.id}/export?format=csv&scope=assets`, '_blank');
    };

    // CSV Import
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [_importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !workspace?.id) return;

        setImporting(true);
        setImportResult(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await csrfFetch(`/api/workspaces/${workspace.id}/assets/import`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || data.error || 'Import failed');
            const result = data.data;
            setImportResult({ imported: result.imported, skipped: result.skipped, errors: result.errors });
            fetchAssets(1);
        } catch (err: unknown) {
            showError('Import Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (loading && assets.length === 0 && categories.length === 0) return <PageSpinner text="Loading assets…" />;
    if (error && assets.length === 0) return <ErrorState title="Failed to load assets" description={error} onRetry={() => fetchAssets()} />;

    const hasActiveFilters = !!(search || categoryId || status);

    return (
        <>
            <ConfirmDialog
                open={showBulkDeleteConfirm}
                title="Delete Selected Assets"
                message={`Delete ${selectedAssets.size} selected asset(s)? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleBulkDelete}
                onCancel={() => setShowBulkDeleteConfirm(false)}
            />

            {/* ── Bulk action bar ── */}
            {showBulkActions && (
                <div className="mb-5 flex items-center justify-between rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-2.5 animate-slide-up">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15">
                            <CheckSquare className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                            <span className="text-primary font-semibold">{selectedAssets.size}</span> selected
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={bulkStatusTarget}
                            onChange={e => { setBulkStatusTarget(e.target.value); if (e.target.value) handleBulkStatusChange(e.target.value); }}
                            disabled={bulkActionLoading}
                            className="input h-8 py-0 text-xs pl-3 pr-7 w-auto rounded-lg"
                        >
                            <option value="">Change status…</option>
                            {statuses.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                        </select>
                        <button
                            type="button"
                            onClick={handleBulkExport}
                            disabled={bulkActionLoading}
                            className="btn-secondary h-8 py-0 text-xs gap-1.5"
                        >
                            Export CSV
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowBulkDeleteConfirm(true)}
                            disabled={bulkActionLoading}
                            className="btn-danger h-8 py-0 text-xs gap-1.5 inline-flex items-center"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {bulkActionLoading ? 'Processing…' : 'Delete'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setSelectedAssets(new Set()); setShowBulkActions(false); }}
                            className="btn-ghost h-8 w-8 p-0 rounded-lg"
                            aria-label="Clear selection"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Page header ── */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Asset Inventory</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {loading
                            ? 'Loading…'
                            : `${pagination.total.toLocaleString()} asset${pagination.total !== 1 ? 's' : ''}${hasActiveFilters ? ' matched' : ' total'}`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleImportCSV}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                        className="inline-flex items-center gap-1.5 bg-surface-container-highest border border-slate-700 hover:bg-slate-700/80 text-on-surface transition-colors font-medium rounded-full px-5 py-2 text-sm disabled:opacity-50"
                    >
                        {importing
                            ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary border-t-transparent" /> Importing…</>
                            : <><Upload className="h-3.5 w-3.5" /> Import</>}
                    </button>
                    <Link href="/assets/new" className="inline-flex items-center gap-1.5 primary-gradient-btn text-on-primary font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all rounded-full px-6 py-2 text-sm">
                        <Plus className="h-4 w-4" />
                        Add Asset
                    </Link>
                </div>
            </div>

            {/* ── Filter toolbar ── */}
            <div className="flex flex-wrap gap-3 mb-8 p-3 bg-surface-container rounded-xl shadow-sm border border-slate-800/20">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search name, model, serial…"
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all py-2 pl-9 pr-3 text-on-surface text-sm outline-none placeholder:text-slate-500"
                    />
                </div>

                <div className="w-px h-6 bg-slate-800/40 hidden sm:block self-center mx-1" aria-hidden="true" />

                {/* Type */}
                <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all py-2 pl-3 pr-8 text-on-surface text-sm outline-none appearance-none"
                >
                    <option value="">All Types</option>
                    <option value="DYNAMIC">Dynamic</option>
                    <option value="PHYSICAL">Physical</option>
                    <option value="DIGITAL">Digital</option>
                </select>

                {/* Category */}
                <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all py-2 pl-3 pr-8 text-on-surface text-sm outline-none appearance-none max-w-[180px] truncate"
                >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>

                {/* Status */}
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all py-2 pl-3 pr-8 text-on-surface text-sm outline-none appearance-none"
                >
                    <option value="">All Statuses</option>
                    {statuses.map((s) => (
                        <option key={s} value={s}>{getStatusLabel(s)}</option>
                    ))}
                </select>

                {/* Clear all */}
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={() => { setSearch(''); setCategoryId(''); setStatus(''); }}
                        className="btn-ghost h-8 text-sm text-muted-foreground inline-flex items-center gap-1 px-2"
                    >
                        <X className="h-3.5 w-3.5" />
                        Clear
                    </button>
                )}
            </div>

            {/* ── Content ── */}
            {loading && assets.length === 0 ? (
                <div className="flex justify-center py-24">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                </div>
            ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                    <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4 border border-border">
                        <svg className="h-6 w-6 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                        {hasActiveFilters ? 'No assets matched' : 'No assets yet'}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                        {hasActiveFilters
                            ? 'Try adjusting your filters to find what you\'re looking for.'
                            : 'Start tracking your IT inventory by adding your first asset.'}
                    </p>
                    {!hasActiveFilters && (
                        <Link href="/assets/new" className="btn-primary mt-5 inline-flex items-center gap-1.5 text-sm h-9 px-4">
                            <Plus className="h-3.5 w-3.5" />
                            Add Your First Asset
                        </Link>
                    )}
                </div>
            ) : (
                <>
                    {/* Card grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {assets.map((asset, i) => {
                            const typeStyle = getTypeStyle(asset.assetType);
                            const isSelected = selectedAssets.has(asset.id);
                            return (
                                <div
                                    key={asset.id}
                                    onClick={() => _router.push(`/assets/${asset.id}`)}
                                    className={[
                                        'asset-card animate-fade-in cursor-pointer transition-all hover:ring-1 hover:ring-primary/50 relative group',
                                        isSelected ? 'selected' : '',
                                    ].join(' ')}
                                    style={{ animationDelay: `${i * 25}ms`, animationFillMode: 'both' }}
                                >
                                    {/* Status accent strip */}
                                    <div
                                        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                                        style={{ background: getStatusAccentColor(asset.status) }}
                                    />

                                    <div className="pl-4 pr-3.5 pt-3.5 pb-3.5">
                                        {/* Top row: checkbox + type badge */}
                                        <div className="flex items-start justify-between mb-2.5">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleAssetSelection(asset.id)}
                                                className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                                                aria-label={`Select ${asset.name}`}
                                                onClick={e => e.stopPropagation()}
                                            />
                                            <span className={`badge text-[10px] font-medium px-2 py-0.5 rounded-md ${typeStyle.cls}`}>
                                                {typeStyle.label}
                                            </span>
                                        </div>

                                        {/* Asset name + model */}
                                        <div className="mb-2.5">
                                            <Link
                                                href={`/assets/${asset.id}`}
                                                className="text-sm font-semibold text-foreground leading-snug hover:text-primary transition-colors line-clamp-1 block"
                                            >
                                                {asset.name}
                                            </Link>
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                                {[asset.manufacturer, asset.model].filter(Boolean).join(' · ') || <span>&nbsp;</span>}
                                            </p>
                                        </div>

                                        {/* Meta: category + location */}
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                                            {asset.category && (
                                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                                    <span>{asset.category.icon}</span>
                                                    <span className="line-clamp-1">{asset.category.name}</span>
                                                </span>
                                            )}
                                            {asset.location && (
                                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                                    <MapPin className="h-3 w-3 shrink-0" />
                                                    <span className="line-clamp-1">{asset.location}</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Footer: assignment + status */}
                                        <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
                                            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                                                <UserCircle className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                                <span className="truncate">
                                                    {asset.assignedTo ? asset.assignedTo.name : 'Unassigned'}
                                                </span>
                                            </span>
                                            <span className={`badge text-[10px] px-1.5 py-0.5 rounded-md ${getStatusColor(asset.status)}`}>
                                                {getStatusLabel(asset.status)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40">
                            <p className="text-xs text-muted-foreground">
                                {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => fetchAssets(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    className="btn-outline h-8 w-8 p-0 rounded-lg disabled:opacity-40"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="flex items-center px-3 text-xs text-muted-foreground font-medium">
                                    {pagination.page} / {pagination.totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => fetchAssets(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                    className="btn-outline h-8 w-8 p-0 rounded-lg disabled:opacity-40"
                                    aria-label="Next page"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </>
    );
}