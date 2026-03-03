'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCategoryOptions, getStatusOptions, ASSET_CATEGORIES, ASSET_STATUSES } from '@/lib/constants/assetConstants';
import { ConfirmDialog } from '@/components/ui';
import { useWorkspace } from '@/lib/workspace/context';

interface Asset {
    id: string;
    assetType: string;
    name: string;
    category: string;
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
    const router = useRouter();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });
    const { workspace } = useWorkspace();
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [assetType, setAssetType] = useState(''); // NEW
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState('');
    const [assignmentFilter, setAssignmentFilter] = useState('');

    // Bulk selection state
    const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
    const [showBulkActions, setShowBulkActions] = useState(false);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);

    const categories = [
        '💻 Laptop',
        '🖥️ Desktop',
        '📱 Mobile Device',
        '🖨️ Printer',
        '📡 Network Equipment',
        '🖥️ Monitor',
        '⚙️ Server',
        '🔌 Peripheral',
        '📦 Other',
    ];

    const statuses = ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED', 'LOST'];

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
            if (assetType) params.set('assetType', assetType); // NEW
            if (category) params.set('category', category);
            if (status) params.set('status', status);
            if (assignmentFilter) params.set('assignedTo', assignmentFilter);

            const response = await csrfFetch(`/api/assets?${params}`);
            if (!response.ok) throw new Error('Failed to fetch assets');

            const result = await response.json();
            const responseData = result.data || {};
            setAssets(responseData.assets || []);
            if (responseData.pagination) {
                setPagination(responseData.pagination);
            }
        } catch (error: unknown) {
            showError('Error fetching assets:', error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    }, [workspace?.id, debouncedSearch, assetType, category, status, assignmentFilter, pagination.limit]); // debounced search

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
                return 'bg-slate-800/50 text-slate-200';
            case 'LOST':
                return 'bg-health-critical/15 text-health-critical';
            default:
                return 'bg-slate-800/50 text-slate-200';
        }
    };

    const getCategoryLabel = (category: string) => {
        const cat = Object.values(ASSET_CATEGORIES).find(c => c.value === category);
        return cat?.label || category;
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

    const handleBulkDelete = async () => {
        setShowBulkDeleteConfirm(false);

        setBulkActionLoading(true);
        try {
            const response = await csrfFetch('/api/assets/bulk/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetIds: Array.from(selectedAssets) }),
            });

            if (!response.ok) throw new Error('Bulk delete failed');

            setSelectedAssets(new Set());
            setShowBulkActions(false);
            fetchAssets(pagination.page);
        } catch (error: unknown) {
            showError('Bulk delete error:', error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkExport = async () => {
        if (!workspace?.id) return;
        window.open(`/api/assets/export?workspaceId=${workspace.id}`, '_blank');
    };

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
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Assets</h1>
                    <p className="text-muted-foreground mt-1">
                        {loading ? 'Loading assets...' : `${pagination.total} asset${pagination.total !== 1 ? 's' : ''} found`}
                    </p>
                </div>
                <Link
                    href="/assets/new"
                    className="btn-primary inline-flex items-center gap-2"
                >
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path d="M12 4v16m8-8H4" />
                    </svg>
                    Add Asset
                </Link>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Search */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Search
                        </label>
                        <input
                            type="text"
                            placeholder="Search by name, model, serial..."
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="input w-full"
                        />
                    </div>

                    {/* Asset Type Filter - NEW */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Type
                        </label>
                        <select
                            value={assetType}
                            onChange={(e) => setAssetType(e.target.value)}
                            className="input w-full"
                        >
                            <option value="">All Types</option>
                            <option value="PHYSICAL">💻 Physical</option>
                            <option value="DIGITAL">☁️ Digital</option>
                        </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Category
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="input w-full"
                        >
                            <option value="">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Status
                        </label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="input w-full"
                        >
                            <option value="">All Statuses</option>
                            {statuses.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Filter Pills */}
                {(search || category || status || assignmentFilter) && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                        {search && (
                            <span className="badge-primary flex items-center gap-1">
                                Search: {search}
                                <button
                                    onClick={() => setSearch('')}
                                    className="ml-1 hover:text-white"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        {category && (
                            <span className="badge-primary flex items-center gap-1">
                                Category: {category}
                                <button
                                    onClick={() => setCategory('')}
                                    className="ml-1 hover:text-white"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        {status && (
                            <span className="badge-primary flex items-center gap-1">
                                Status: {status}
                                <button
                                    onClick={() => setStatus('')}
                                    className="ml-1 hover:text-white"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Bulk Actions Bar */}
            {showBulkActions && (
                <div className="card mb-4 bg-nerve/10 border-nerve/30">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-foreground">
                            {selectedAssets.size} asset(s) selected
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleBulkExport}
                                disabled={bulkActionLoading}
                                className="btn-secondary text-sm"
                            >
                                📄 Export Selected
                            </button>
                            <button
                                onClick={() => setShowBulkDeleteConfirm(true)}
                                disabled={bulkActionLoading}
                                className="btn bg-destructive text-white hover:bg-destructive/80 text-sm"
                            >
                                {bulkActionLoading ? 'Deleting...' : '🗑️ Delete Selected'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assets Table/List */}
            {loading ? (
                <div className="card">
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nerve"></div>
                    </div>
                </div>
            ) : assets.length === 0 ? (
                <div className="card text-center py-12">
                    <svg
                        className="mx-auto h-12 w-12 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                    </svg>
                    <h3 className="mt-2 text-lg font-medium text-foreground">No assets found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {search || category || status
                            ? 'Try adjusting your filters'
                            : 'Get started by creating a new asset'}
                    </p>
                    {!search && !category && !status && (
                        <div className="mt-6">
                            <Link href="/assets/new" className="btn-primary">
                                Add Your First Asset
                            </Link>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div className="card overflow-hidden">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-6 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedAssets.size === assets.length && assets.length > 0}
                                            onChange={toggleSelectAll}
                                            className="rounded border-slate-700"
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Asset
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Assignment
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Location
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {assets.map((asset) => (
                                    <tr key={asset.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedAssets.has(asset.id)}
                                                onChange={() => toggleAssetSelection(asset.id)}
                                                className="rounded border-slate-700"
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-medium text-foreground">
                                                            {asset.name}
                                                        </div>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${asset.assetType === 'PHYSICAL'
                                                            ? 'bg-nerve/10 text-nerve'
                                                            : 'bg-purple-500/10 text-purple-500'
                                                            }`}>
                                                            {asset.assetType === 'PHYSICAL' ? '💻' : '☁️'}
                                                        </span>
                                                    </div>
                                                    {asset.manufacturer && asset.model && (
                                                        <div className="text-sm text-muted-foreground">
                                                            {asset.manufacturer} {asset.model}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-foreground">{getCategoryLabel(asset.category)}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`badge ${getStatusColor(asset.status)}`}>
                                                {getStatusLabel(asset.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {asset.assignedTo ? (
                                                <div className="text-sm text-foreground">
                                                    {asset.assignedTo.name}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-foreground">
                                                {asset.location || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Link
                                                href={`/assets/${asset.id}`}
                                                className="text-nerve hover:text-nerve/80 transition-colors"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                            <div className="text-sm text-muted-foreground">
                                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                {pagination.total} assets
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => fetchAssets(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => fetchAssets(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </>
    );
}
