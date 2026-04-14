'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Monitor, Apple, Terminal, Download, CheckCircle2 } from 'lucide-react';

export default function DownloadAgentPage() {
    const [selectedPlatform, setSelectedPlatform] = useState<'windows' | 'macos' | 'linux'>('windows');
    const [downloadStarted, setDownloadStarted] = useState(false);
    const [version, setVersion] = useState('latest');

    useEffect(() => {
        // Fetch latest version from the agent version API
        fetch('/api/agent/check-update?platform=windows&version=0.0.0')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.data?.latestVersion) {
                    setVersion(data.data.latestVersion);
                }
            })
            .catch(() => { /* Keep 'latest' fallback */ });
    }, []);

    const platforms = [
        {
            id: 'windows' as const,
            name: 'Windows',
            icon: Monitor,
            file: `glanus-agent-${version}.msi`,
            size: '~15 MB',
            requirements: 'Windows 10 or later',
            instructions: [
                'Download the MSI installer',
                'Run the installer (may require administrator privileges)',
                'Follow the installation wizard',
                'The agent will start automatically as a Windows Service',
                'Check the system tray for the Glanus icon',
            ],
        },
        {
            id: 'macos' as const,
            name: 'macOS',
            icon: Apple,
            file: `glanus-agent-${version}.pkg`,
            size: '~20 MB',
            requirements: 'macOS 13 (Ventura) or later',
            instructions: [
                'Download the PKG installer',
                'Open the PKG file',
                'Follow the installation wizard',
                'The agent will start automatically via LaunchAgent',
                'Check the menu bar for the Glanus icon',
            ],
        },
        {
            id: 'linux' as const,
            name: 'Linux',
            icon: Terminal,
            file: `glanus-agent_${version}_amd64.deb`,
            size: '~12 MB',
            requirements: 'Ubuntu 20.04+ or Debian 11+',
            instructions: [
                'Download the DEB package',
                'Run: sudo dpkg -i glanus-agent_0.1.0_amd64.deb',
                'The agent will start automatically via systemd',
                'Check status: systemctl status glanus-agent',
            ],
        },
    ];

    const selectedPlatformData = platforms.find(p => p.id === selectedPlatform)!;
    const Icon = selectedPlatformData.icon;

    const handleDownload = async () => {
        setDownloadStarted(true);

        const baseUrl = process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL
            || 'https://releases.glanus.io/agent';
        const downloadUrl = `${baseUrl}/v${version}/${selectedPlatformData.file}`;

        // Trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = selectedPlatformData.file;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Reset after 3 seconds
        setTimeout(() => setDownloadStarted(false), 3000);
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Download Glanus Agent</h1>
                <p className="text-muted">
                    Install the Glanus Agent to enable remote monitoring and management of your assets.
                </p>
            </div>

            {/* Platform Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {platforms.map((platform) => {
                    const PlatformIcon = platform.icon;
                    return (
                        <Card
                            key={platform.id}
                            className={`cursor-pointer transition-all hover:scale-105 ${selectedPlatform === platform.id
                                ? 'ring-2 ring-primary bg-nerve/5'
                                : ''
                                }`}
                            onClick={() => setSelectedPlatform(platform.id)}
                        >
                            <div className="flex flex-col items-center gap-3 p-6">
                                <PlatformIcon className="text-4xl" />
                                <h3 className="font-semibold text-lg">{platform.name}</h3>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Download Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Details */}
                <Card>
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Icon className="text-3xl" />
                            <div>
                                <h2 className="text-xl font-bold">{selectedPlatformData.name}</h2>
                                <p className="text-sm text-muted">Version {version}</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <p className="text-sm font-medium text-muted mb-1">File</p>
                                <p className="font-mono text-sm">{selectedPlatformData.file}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted mb-1">Size</p>
                                <p>{selectedPlatformData.size}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted mb-1">Requirements</p>
                                <p>{selectedPlatformData.requirements}</p>
                            </div>
                        </div>

                        <Button
                            onClick={handleDownload}
                            className="w-full"
                            disabled={downloadStarted}
                        >
                            {downloadStarted ? (
                                <>
                                    <CheckCircle2 className="mr-2 w-4 h-4" />
                                    Download Started
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 w-4 h-4" />
                                    Download for {selectedPlatformData.name}
                                </>
                            )}
                        </Button>
                    </div>
                </Card>

                {/* Right: Instructions */}
                <Card>
                    <div className="p-6">
                        <h3 className="text-lg font-bold mb-4">Installation Instructions</h3>
                        <ol className="space-y-3">
                            {selectedPlatformData.instructions.map((step, index) => (
                                <li key={index} className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-nerve/10 flex items-center justify-center text-sm font-bold">
                                        {index + 1}
                                    </span>
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ol>

                        <div className="mt-6 p-4 bg-warning/10 rounded-lg border border-warning/20">
                            <p className="text-sm">
                                <strong>Note:</strong> After installation, you'll need to register the agent with your workspace
                                using the pre-auth token provided in your asset settings.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Features */}
            <Card className="mt-8">
                <div className="p-6">
                    <h3 className="text-lg font-bold mb-4">What's Included</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="text-success mt-1 w-4 h-4" />
                            <div>
                                <p className="font-medium">System Monitoring</p>
                                <p className="text-sm text-muted">CPU, RAM, Disk, Network usage</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="text-success mt-1 w-4 h-4" />
                            <div>
                                <p className="font-medium">Remote Scripts</p>
                                <p className="text-sm text-muted">PowerShell, Bash, Python execution</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="text-success mt-1 w-4 h-4" />
                            <div>
                                <p className="font-medium">Auto-Updates</p>
                                <p className="text-sm text-muted">Automatic agent updates</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="text-success mt-1 w-4 h-4" />
                            <div>
                                <p className="font-medium">Secure Storage</p>
                                <p className="text-sm text-muted">Credentials in OS keychain</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="text-success mt-1 w-4 h-4" />
                            <div>
                                <p className="font-medium">Real-time Heartbeat</p>
                                <p className="text-sm text-muted">60-second status updates</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="text-success mt-1 w-4 h-4" />
                            <div>
                                <p className="font-medium">System Tray UI</p>
                                <p className="text-sm text-muted">Easy access to metrics</p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Help */}
            <Card className="mt-8">
                <div className="p-6">
                    <h3 className="text-lg font-bold mb-2">Need Help?</h3>
                    <p className="text-muted mb-4">
                        Check out our documentation or contact support if you encounter any issues.
                    </p>
                    <div className="flex gap-4">
                        <Button variant="secondary">
                            View Documentation
                        </Button>
                        <Button variant="secondary">
                            Contact Support
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
