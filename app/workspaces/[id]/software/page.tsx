'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/ui/EmptyState';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { Search, ArrowUpDown, Box, Server } from 'lucide-react';

interface SoftwareItem {
    name: string;
    version: string | null;
    publisher: string | null;
    installCount: number;
}

function SoftwareInventoryContent() {
    const params = useParams();
    const workspaceId = params?.id as string;
    const { error: showError } = useToast();

    const [software, setSoftware] = useState<SoftwareItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [sortField, setSortField] = useState<keyof SoftwareItem>('installCount');
    const [sortDesc, setSortDesc] = useState(true);

    useEffect(() => {
        if (workspaceId) fetchInventory();
    }, [workspaceId]);

    const fetchInventory = async () => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/software`);
            if (!res.ok) throw new Error('Failed to load software inventory');
            const data = await res.json();
            setSoftware(data.data?.software || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
            showError('Load Error', 'Could not fetch workspace software inventory.');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: keyof SoftwareItem) => {
        if (sortField === field) {
            setSortDesc(!sortDesc);
        } else {
            setSortField(field);
            setSortDesc(field === 'installCount'); // Default descending for counts
        }
    };

    if (loading) return <PageSpinner />;
    if (error) return <ErrorState title="Failed to Load Inventory" description={error} onRetry={() => { setError(null); setLoading(true); fetchInventory(); }} />;

    const sortedFilteredSoftware = software
        .filter(sw =>
            sw.name.toLowerCase().includes(query.toLowerCase()) ||
            (sw.publisher && sw.publisher.toLowerCase().includes(query.toLowerCase())) ||
            (sw.version && sw.version.toLowerCase().includes(query.toLowerCase()))
        )
        .sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            if (valA === null) valA = '';
            if (valB === null) valB = '';

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortDesc ? valB - valA : valA - valB;
            }
            return 0;
        });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Software Inventory</h1>
                    <p className="text-sm text-slate-400 mt-1">Aggregated installed applications across all active endpoint agents.</p>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden flex flex-col min-h-[500px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/50">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search applications, publishers, or versions..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-health-good focus:ring-1 focus:ring-health-good transition"
                        />
                    </div>
                    <div className="text-sm text-slate-500 shrink-0">
                        {sortedFilteredSoftware.length} Unique Titles Found
                    </div>
                </div>

                {software.length === 0 ? (
                    <EmptyState
                        icon={<Box className="w-16 h-16" />}
                        title="No Software Inventory Found"
                        description="Glanus Agents will automatically report installed applications during their telemetry cycles. Please ensure endpoints are active."
                    />
                ) : (
                    <div className="overflow-x-auto flex-grow">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/50 text-xs text-slate-400 uppercase tracking-wider">
                                    <th className="p-4 font-medium hover:text-slate-200 cursor-pointer select-none" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1">
                                            Application {sortField === 'name' && <ArrowUpDown className="w-3 h-3" />}
                                        </div>
                                    </th>
                                    <th className="p-4 font-medium hover:text-slate-200 cursor-pointer select-none" onClick={() => handleSort('publisher')}>
                                        <div className="flex items-center gap-1">
                                            Publisher {sortField === 'publisher' && <ArrowUpDown className="w-3 h-3" />}
                                        </div>
                                    </th>
                                    <th className="p-4 font-medium hover:text-slate-200 cursor-pointer select-none" onClick={() => handleSort('version')}>
                                        <div className="flex items-center gap-1">
                                            Version {sortField === 'version' && <ArrowUpDown className="w-3 h-3" />}
                                        </div>
                                    </th>
                                    <th className="p-4 font-medium text-right hover:text-slate-200 cursor-pointer select-none" onClick={() => handleSort('installCount')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Endpoints Installed {sortField === 'installCount' && <ArrowUpDown className="w-3 h-3" />}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {sortedFilteredSoftware.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-500">
                                            No software matched your search query.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedFilteredSoftware.map((sw, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/30 transition group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-md bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 group-hover:bg-slate-700 transition">
                                                        <Box className="w-4 h-4 text-slate-400 group-hover:text-slate-300" />
                                                    </div>
                                                    <span className="font-medium text-slate-200">{sw.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-400">
                                                {sw.publisher || 'Unknown Publisher'}
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 text-xs font-mono bg-slate-950 border border-slate-800 text-slate-300 rounded overflow-hidden text-ellipsis max-w-[150px] inline-block whitespace-nowrap">
                                                    {sw.version || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="inline-flex items-center gap-2 bg-health-good/10 text-health-good border border-health-good/20 px-3 py-1 rounded-full text-sm font-medium">
                                                    <Server className="w-3.5 h-3.5" />
                                                    {sw.installCount}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function FleetSoftwarePage() {
    return (
        <WorkspaceLayout>
            <Suspense fallback={<PageSpinner />}>
                <SoftwareInventoryContent />
            </Suspense>
        </WorkspaceLayout>
    );
}
