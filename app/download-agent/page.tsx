'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Monitor, Apple, Terminal, Download, CheckCircle2, Copy } from 'lucide-react';

function detectPlatform(): 'windows' | 'macos' | 'linux' {
    if (typeof navigator === 'undefined') return 'windows';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    return 'linux';
}

function CopyableCommand({ cmd }: { cmd: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(cmd).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };
    return (
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2 font-mono text-xs text-foreground">
            <span className="flex-1 break-all">{cmd}</span>
            <button type="button" onClick={copy} title="Copy" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-health-good" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
        </div>
    );
}

export default function DownloadAgentPage() {
    const [selectedPlatform, setSelectedPlatform] = useState<'windows' | 'macos' | 'linux'>('windows');
    const [downloadStarted, setDownloadStarted] = useState(false);
    const [version, setVersion] = useState('latest');

    useEffect(() => {
        setSelectedPlatform(detectPlatform());
    }, []);

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
            requirements: 'Windows 10 / Server 2019 or later',
            instructions: [
                { text: 'Download the MSI installer' },
                { text: 'Run the installer (requires administrator privileges)' },
                { text: 'Follow the installation wizard' },
                { text: 'The agent adds an auto-start entry and launches as a tray app when a user signs in' },
                { text: 'Check the system tray for the Glanus icon' },
            ],
            verifyTitle: 'Verify installation',
            verifyCmds: [
                'Get-Process glanus-agent -ErrorAction SilentlyContinue',
                'Test-Path "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp\\Glanus Agent.lnk"',
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
                { text: 'Download the PKG installer' },
                { text: 'Open the PKG file and follow the wizard' },
                { text: 'Allow the installer in System Settings → Privacy & Security if prompted' },
                { text: 'The agent starts automatically via LaunchAgent' },
                { text: 'Check the menu bar for the Glanus icon' },
            ],
            verifyTitle: 'Verify installation',
            verifyCmds: [
                'launchctl print gui/$(id -u)/com.glanus.agent',
                'cat /Library/LaunchAgents/com.glanus.agent.plist',
            ],
        },
        {
            id: 'linux' as const,
            name: 'Linux',
            icon: Terminal,
            file: `glanus-agent_${version}_amd64.deb`,
            size: '~12 MB',
            requirements: 'Ubuntu 20.04+ / Debian 11+ / RHEL 8+ (headless compatible)',
            instructions: [
                { text: 'Download the package for your distro (DEB or RPM below)' },
                { text: 'Ubuntu / Debian:', cmd: `sudo dpkg -i glanus-agent_${version}_amd64.deb` },
                { text: 'RHEL / Fedora / CentOS:', cmd: `sudo rpm -i glanus-agent-${version}-1.x86_64.rpm` },
                { text: 'Enable and start the service:', cmd: 'sudo systemctl enable --now glanus-agent' },
                { text: 'The agent runs as a background daemon — no display/GUI required' },
            ],
            verifyTitle: 'Check service status',
            verifyCmds: [
                'systemctl status glanus-agent',
                'journalctl -u glanus-agent -f',
            ],
        },
    ];

    const selectedPlatformData = platforms.find(p => p.id === selectedPlatform)!;
    const Icon = selectedPlatformData.icon;

    const handleDownload = async (fileOverride?: string) => {
        setDownloadStarted(true);

        const baseUrl = process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL
            || 'https://releases.glanus.io/agent';
        const file = fileOverride ?? selectedPlatformData.file;
        const downloadUrl = `${baseUrl}/v${version}/${file}`;

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = file;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

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
                            onClick={() => handleDownload()}
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
                                    {selectedPlatform === 'linux' ? ' (DEB)' : ''}
                                </>
                            )}
                        </Button>

                        {/* Linux: also offer RPM */}
                        {selectedPlatform === 'linux' && (
                            <Button
                                variant="secondary"
                                onClick={() => handleDownload(`glanus-agent-${version}-1.x86_64.rpm`)}
                                className="w-full mt-2"
                                disabled={downloadStarted}
                            >
                                <Download className="mr-2 w-4 h-4" />
                                Download for Linux (RPM)
                            </Button>
                        )}
                    </div>
                </Card>

                {/* Right: Instructions */}
                <Card>
                    <div className="p-6">
                        <h3 className="text-lg font-bold mb-4">Installation Instructions</h3>
                        <ol className="space-y-3">
                            {selectedPlatformData.instructions.map((step, index) => (
                                <li key={index} className="flex flex-col gap-1.5">
                                    <div className="flex gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-nerve/10 flex items-center justify-center text-sm font-bold">
                                            {index + 1}
                                        </span>
                                        <span>{step.text}</span>
                                    </div>
                                    {step.cmd && (
                                        <div className="ml-9">
                                            <CopyableCommand cmd={step.cmd} />
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ol>

                        {/* Verify section */}
                        <div className="mt-6 border-t border-border pt-5">
                            <p className="text-sm font-semibold mb-2">{selectedPlatformData.verifyTitle}</p>
                            <div className="space-y-1.5">
                                {selectedPlatformData.verifyCmds.map((cmd, i) => (
                                    <CopyableCommand key={i} cmd={cmd} />
                                ))}
                            </div>
                        </div>

                        <div className="mt-5 p-4 bg-warning/10 rounded-lg border border-warning/20">
                            <p className="text-sm">
                                <strong>Note:</strong> After installation, register the agent with your workspace
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
                                <p className="font-medium">System Tray / Daemon</p>
                                <p className="text-sm text-muted">Tray icon on Windows/macOS · Systemd service on Linux</p>
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
