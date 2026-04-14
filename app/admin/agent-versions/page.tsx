import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Plus, Download, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AgentVersionsPage() {
    const versions = await prisma.agentVersion.findMany({
        orderBy: [
            { platform: 'asc' },
            { createdAt: 'desc' }
        ]
    });

    // Group by platform
    const mappedVersions = {
        WINDOWS: versions.filter((v: any) => v.platform === 'WINDOWS'),
        MACOS: versions.filter((v: any) => v.platform === 'MACOS'),
        LINUX: versions.filter((v: any) => v.platform === 'LINUX'),
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">Agent Versions</h1>
                    <p className="text-muted-foreground">Manage OTA update payloads and installer distributions.</p>
                </div>
                <Link href="/admin/agent-versions/new">
                    <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        Publish Version
                    </Button>
                </Link>
            </div>

            {Object.entries(mappedVersions).map(([platform, platVersions]) => (
                <div key={platform} className="space-y-4">
                    <h2 className="text-lg font-semibold text-foreground capitalize flex items-center gap-2">
                        {platform.toLowerCase()} Builds
                        <Badge variant="info" className="text-xs">
                            {platVersions.length} Total
                        </Badge>
                    </h2>

                    <div className="grid gap-4">
                        {platVersions.length === 0 ? (
                            <div className="p-6 rounded-xl border border-dashed border-border text-center text-muted-foreground">
                                No releases published yet.
                            </div>
                        ) : (
                            platVersions.map((version: any) => (
                                <Card key={version.id} className="p-4 flex items-center justify-between hover:border-border transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                            {version.status === 'ACTIVE' ? (
                                                <CheckCircle2 className="w-5 h-5 text-health-good" />
                                            ) : version.status === 'BETA' ? (
                                                <AlertCircle className="w-5 h-5 text-health-warn" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-semibold text-foreground">v{version.version}</h3>
                                                {version.status === 'ACTIVE' && (
                                                    <Badge variant="success" className="text-xs">Active Release</Badge>
                                                )}
                                                {version.status === 'DEPRECATED' && (
                                                    <Badge variant="danger" className="text-xs">Deprecated</Badge>
                                                )}
                                                {version.required && (
                                                    <Badge variant="warning" className="text-xs">
                                                        Mandatory Update
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1.5">
                                                    <FileText className="w-3.5 h-3.5" />
                                                    {new Date(version.createdAt).toLocaleDateString()}
                                                </span>
                                                <code className="px-1.5 py-0.5 rounded bg-surface-1 text-xs font-mono">
                                                    SHA-256: {version.checksum.substring(0, 12)}...
                                                </code>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <a href={version.downloadUrl} download>
                                            <Button variant="secondary" size="sm">
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                        </a>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
