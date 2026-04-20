'use client';
import { useState, useEffect, Suspense } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationMeta } from '@/components/ui/Pagination';
import { Network, Server, Printer, Settings, Signal, Computer, ScanSearch } from 'lucide-react';

interface NetworkDevice {
    id: string;
    ipAddress: string;
    macAddress: string | null;
    hostname: string | null;
    deviceType: string;
    lastSeen: string;
    discoveredBy: {
        hostname: string;
        platform: string;
    } | null;
}

interface DiscoveryScan {
    id: string;
    subnet: string;
    status: string;
    devicesFound: number;
    createdAt: string;
    agent: {
        hostname: string;
    };
}

function getDeviceIcon(type: string) {
    switch (type?.toUpperCase()) {
        case 'ROUTER':
            return <Network className="h-5 w-5 text-indigo-400" />;
        case 'SWITCH':
            return <Server className="h-5 w-5 text-cortex" />;
        case 'PRINTER':
            return <Printer className="h-5 w-5 text-purple-400" />;
        case 'MOBILE_DEVICE':
            return <Signal className="h-5 w-5 text-emerald-400" />;
        case 'DESKTOP':
        case 'LAPTOP':
            return <Computer className="h-5 w-5 text-muted-foreground" />;
        default:
            return <Settings className="h-5 w-5 text-muted-foreground" />;
    }
}

function NetworkDashboardContent() {
    const workspaceId = useWorkspaceId();
    const { error: showError, success: showSuccess } = useToast();

    const [devices, setDevices] = useState<NetworkDevice[]>([]);
    const [scans, setScans] = useState<DiscoveryScan[]>([]);
    const [loading, setLoading] = useState(true);
    const [sweeping, setSweeping] = useState(false);
    const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });

    useEffect(() => {
        if (workspaceId) {
            fetchNetworkData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    const fetchNetworkData = async (page = 1) => {
        setLoading(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/network?page=${page}&limit=20`);
            if (!res.ok) throw new Error('Failed to fetch network topology');
            const data = await res.json();
            setDevices(data.data?.devices || []);
            setScans(data.data?.recentScans || []);
            if (data.data?.pagination) setPagination(data.data.pagination);
        } catch (err: unknown) {
            showError('Data Error', err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleSubnetSweep = async () => {
        setSweeping(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/network/sweep`, {
                method: 'POST',
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || data.error || 'Sweep failed');
            }
            showSuccess('Sweep Initiated', 'Subnet sweep dispatched to connected agents.');
            // Refresh data after a short delay
            setTimeout(fetchNetworkData, 2000);
        } catch (err: unknown) {
            showError('Sweep Failed', err instanceof Error ? err.message : 'Could not initiate subnet sweep');
        } finally {
            setSweeping(false);
        }
    };

    if (loading) return <PageSpinner text="Loading topology…" />;

    return (
        <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Network Discovery</h1>
                    <p className="text-sm text-muted-foreground mt-1">Automatically map unmanaged hardware natively across installed agent subnets.</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-secondary h-9 text-sm px-4" onClick={() => { void fetchNetworkData(pagination.page); }}>
                        Refresh Map
                    </button>
                    <button className="btn-primary h-9 text-sm px-4 gap-2" onClick={handleSubnetSweep} disabled={sweeping}>
                        <ScanSearch className="h-4 w-4" /> {sweeping ? 'Sweeping…' : 'Emit Subnet Sweep'}
                    </button>
                </div>
            </div>

            {devices.length === 0 ? (
                <EmptyState
                    icon={<Network className="w-16 h-16 text-muted-foreground animate-pulse" />}
                    title="No Devices Mapped"
                    description="The network topology is empty. Launch a Subnet Sweep from a managed agent to catalog routers, switches, and printers."
                    action={{ label: 'Start Discovery Scan', onClick: handleSubnetSweep }}
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3 space-y-4">
                        <div className="bg-surface-container border border-border shadow-sm rounded-xl overflow-hidden animate-fade-in">
                            <div className="p-5 border-b border-border/50 bg-surface-container-low/30">
                                <h2 className="text-lg font-semibold text-on-surface">Discovered Endpoints</h2>
                                <p className="text-sm text-muted-foreground mt-0.5">Hardware identified lacking a Glanus Agent installation.</p>
                            </div>
                            <div>
                                <div className="divide-y divide-border/50">
                                    {devices.map((device, i) => (
                                        <div 
                                            key={device.id} 
                                            className="p-4 hover:bg-surface-container-highest transition-colors flex items-center gap-4 cursor-pointer group"
                                            style={{ animationDelay: `${i * 15}ms`, animationFillMode: 'both' }}
                                        >
                                            <div className="h-10 w-10 rounded-xl bg-surface-container-low border border-border/50 flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors shadow-sm">
                                                {getDeviceIcon(device.deviceType)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-medium text-on-surface truncate">
                                                        {device.hostname || 'Unknown Endpoint'}
                                                    </h3>
                                                    <span className="badge text-[10px] px-2 rounded-md bg-surface-container-highest text-on-surface border border-border">
                                                        {device.deviceType}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-1 text-xs text-muted-foreground font-mono">
                                                    <span>IP: <span className="text-muted-foreground">{device.ipAddress}</span></span>
                                                    {device.macAddress && <span>MAC: <span className="text-muted-foreground">{device.macAddress}</span></span>}
                                                </div>
                                            </div>
                                            <div className="text-right hidden sm:block shrink-0">
                                                <div className="text-xs text-muted-foreground mb-1">Found by:</div>
                                                <div className="text-sm text-on-surface flex items-center gap-1 justify-end font-medium">
                                                    <Computer className="h-3 w-3 text-muted-foreground" /> {device.discoveredBy?.hostname || 'Unknown Agent'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="px-5 pb-4">
                                <Pagination pagination={pagination} onPageChange={fetchNetworkData} noun="devices" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-surface-container border border-border shadow-sm rounded-xl overflow-hidden animate-fade-in delay-100">
                            <div className="p-4 border-b border-border/50 bg-surface-container-low/30">
                                <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Subnet Sweep History</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                {scans.length > 0 ? scans.map(scan => (
                                    <div key={scan.id} className="flex justify-between items-center text-sm">
                                        <div>
                                            <div className="font-mono text-health-good font-medium">{scan.subnet}</div>
                                            <div className="text-xs text-muted-foreground mt-1">via <span className="text-on-surface">{scan.agent?.hostname || 'System'}</span></div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`badge mb-1 text-[10px] px-1.5 h-4 border ${scan.status === 'COMPLETED' ? 'bg-health-good/15 text-health-good border-health-good/20' : 'bg-health-warn/15 text-health-warn border-health-warn/20'}`}>
                                                {scan.status}
                                            </span>
                                            <div className="text-xs text-muted-foreground font-medium mt-1">{scan.devicesFound} found</div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-sm text-muted-foreground text-center py-4 bg-surface-container-low border border-border/50 border-dashed rounded-xl">No recent scans.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function NetworkPage() {
    return (
        <WorkspaceLayout>
            <Suspense fallback={<PageSpinner />}>
                <NetworkDashboardContent />
            </Suspense>
        </WorkspaceLayout>
    );
}
