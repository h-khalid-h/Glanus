'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { Network, Server, Printer, Settings, Signal, Computer, ScanSearch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

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
            return <Server className="h-5 w-5 text-blue-400" />;
        case 'PRINTER':
            return <Printer className="h-5 w-5 text-purple-400" />;
        case 'MOBILE_DEVICE':
            return <Signal className="h-5 w-5 text-emerald-400" />;
        case 'DESKTOP':
        case 'LAPTOP':
            return <Computer className="h-5 w-5 text-slate-400" />;
        default:
            return <Settings className="h-5 w-5 text-slate-500" />;
    }
}

function NetworkDashboardContent() {
    const params = useParams();
    const workspaceId = params?.id as string;
    const { error: showError } = useToast();

    const [devices, setDevices] = useState<NetworkDevice[]>([]);
    const [scans, setScans] = useState<DiscoveryScan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (workspaceId) {
            fetchNetworkData();
        }
    }, [workspaceId]);

    const fetchNetworkData = async () => {
        setLoading(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/network`);
            if (!res.ok) throw new Error('Failed to fetch network topology');
            const data = await res.json();
            setDevices(data.data?.devices || []);
            setScans(data.data?.recentScans || []);
        } catch (err: unknown) {
            showError('Data Error', err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <PageSpinner />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Network Discovery</h1>
                    <p className="text-sm text-slate-400 mt-1">Automatically map unmanaged hardware natively across installed agent subnets.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={fetchNetworkData}>
                        Refresh Map
                    </Button>
                    <Button className="gap-2">
                        <ScanSearch size={16} /> Emit Subnet Sweep
                    </Button>
                </div>
            </div>

            {devices.length === 0 ? (
                <EmptyState
                    icon={<Network className="w-16 h-16 text-slate-600 animate-pulse" />}
                    title="No Devices Mapped"
                    description="The network topology is empty. Launch a Subnet Sweep from a managed agent to catalog routers, switches, and printers."
                    action={{ label: 'Start Discovery Scan', onClick: () => { } }}
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3 space-y-4">
                        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                            <CardHeader className="pb-3 border-b border-slate-800">
                                <CardTitle className="text-lg">Discovered Endpoints</CardTitle>
                                <CardDescription>Hardware identified lacking a Glanus Agent installation.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-800/50">
                                    {devices.map((device) => (
                                        <div key={device.id} className="p-4 hover:bg-slate-800/20 transition-colors flex items-center gap-4 cursor-pointer group">
                                            <div className="h-10 w-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 group-hover:border-indigo-500/50 transition-colors">
                                                {getDeviceIcon(device.deviceType)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-medium text-slate-200 truncate">
                                                        {device.hostname || 'Unknown Endpoint'}
                                                    </h3>
                                                    <Badge variant="info" className="text-xs bg-slate-950/50 px-2 py-0 h-5">
                                                        {device.deviceType}
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-1 text-xs text-slate-500 font-mono">
                                                    <span>IP: <span className="text-slate-400">{device.ipAddress}</span></span>
                                                    {device.macAddress && <span>MAC: <span className="text-slate-400">{device.macAddress}</span></span>}
                                                </div>
                                            </div>
                                            <div className="text-right hidden sm:block shrink-0">
                                                <div className="text-xs text-slate-500 mb-1">Found by:</div>
                                                <div className="text-sm text-slate-300 flex items-center gap-1 justify-end">
                                                    <Computer size={12} /> {device.discoveredBy?.hostname || 'Unknown Agent'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <Card className="border-slate-800 bg-slate-900/50">
                            <CardHeader className="pb-3 border-b border-slate-800">
                                <CardTitle className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Subnet Sweep History</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                {scans.length > 0 ? scans.map(scan => (
                                    <div key={scan.id} className="flex justify-between items-center text-sm">
                                        <div>
                                            <div className="font-mono text-emerald-400">{scan.subnet}</div>
                                            <div className="text-xs text-slate-500 mt-1">via {scan.agent?.hostname || 'System'}</div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant={scan.status === 'COMPLETED' ? 'success' : 'warning'} className="mb-1 text-[10px] px-1 h-4">
                                                {scan.status}
                                            </Badge>
                                            <div className="text-xs text-slate-400">{scan.devicesFound} found</div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-sm text-slate-500 text-center py-4">No recent scans.</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
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
