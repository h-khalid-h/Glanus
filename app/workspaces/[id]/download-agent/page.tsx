'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/lib/toast';

export default function DownloadAgentPage() {
    const params = useParams();
    const workspaceId = params?.id as string;

    const { error: showError, success: showSuccess } = useToast();
    const [platform, setPlatform] = useState<'windows' | 'macos' | 'linux'>('windows');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [downloadInfo, setDownloadInfo] = useState<{
        downloadUrl: string;
        preAuthToken: string;
        expiresAt: string;
    } | null>(null);

    const generateDownloadLink = async () => {
        setGenerating(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/download-agent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to generate download link');
            }

            const data = await res.json();
            setDownloadInfo(data);

            // Trigger download
            if (data.downloadUrl) {
                const a = document.createElement('a');
                a.href = data.downloadUrl;
                a.download = '';
                a.click();
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Download generation failed';
            showError('Error', msg);
            setError(msg);
        } finally {
            setGenerating(false);
        }
    };


    if (error) return <ErrorState title="Something went wrong" description={error} onRetry={() => window.location.reload()} />;

    return (
        <>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="text-6xl mb-4">📡</div>
                    <h1 className="text-4xl font-bold text-white mb-2">Download Glanus Agent</h1>
                    <p className="text-lg text-slate-400">
                        Install the agent on your devices for remote monitoring and management
                    </p>
                </div>

                {/* Platform Selector */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-8 mb-8">
                    <h2 className="text-2xl font-semibold mb-6">Select Your Platform</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <button type="button"
                            onClick={() => setPlatform('windows')}
                            className={`p-6 border-2 rounded-lg transition ${platform === 'windows'
                                ? 'border-nerve bg-nerve/5'
                                : 'border-slate-800 hover:border-slate-700'
                                }`}
                        >
                            <div className="text-4xl mb-2">🪟</div>
                            <h3 className="font-semibold text-lg mb-1">Windows</h3>
                            <p className="text-sm text-slate-400">Windows 10/11</p>
                        </button>

                        <button type="button"
                            onClick={() => setPlatform('macos')}
                            className={`p-6 border-2 rounded-lg transition ${platform === 'macos'
                                ? 'border-nerve bg-nerve/5'
                                : 'border-slate-800 hover:border-slate-700'
                                }`}
                        >
                            <div className="text-4xl mb-2">🍎</div>
                            <h3 className="font-semibold text-lg mb-1">macOS</h3>
                            <p className="text-sm text-slate-400">macOS 12+</p>
                        </button>

                        <button type="button"
                            onClick={() => setPlatform('linux')}
                            className={`p-6 border-2 rounded-lg transition ${platform === 'linux'
                                ? 'border-nerve bg-nerve/5'
                                : 'border-slate-800 hover:border-slate-700'
                                }`}
                        >
                            <div className="text-4xl mb-2">🐧</div>
                            <h3 className="font-semibold text-lg mb-1">Linux</h3>
                            <p className="text-sm text-slate-400">Ubuntu/Debian</p>
                        </button>
                    </div>

                    <button type="button"
                        onClick={generateDownloadLink}
                        disabled={generating}
                        className="w-full py-4 bg-nerve text-white rounded-lg font-semibold text-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generating ? 'Preparing Download...' : `Download for ${platform === 'windows' ? 'Windows' : platform === 'macos' ? 'macOS' : 'Linux'}`}
                    </button>

                    <p className="text-sm text-slate-500 mt-4 text-center">
                        Download includes workspace credentials for automatic setup
                    </p>
                </div>

                {/* Installation Instructions */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-8 mb-8">
                    <h2 className="text-2xl font-semibold mb-6">Installation Instructions</h2>

                    {platform === 'windows' && (
                        <div className="space-y-4">
                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">1</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Download the installer</h3>
                                    <p className="text-sm text-slate-400">Click the download button above to get GlanusAgent.msi</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">2</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Run the installer</h3>
                                    <p className="text-sm text-slate-400">Double-click GlanusAgent.msi and follow the setup wizard</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">3</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Agent starts automatically</h3>
                                    <p className="text-sm text-slate-400">The agent will connect to Glanus and appear in your dashboard within 60 seconds</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">4</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Verify connection</h3>
                                    <p className="text-sm text-slate-400">Check the system tray for the Glanus icon or visit your agents dashboard</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {platform === 'macos' && (
                        <div className="space-y-4">
                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">1</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Download the package</h3>
                                    <p className="text-sm text-slate-400">Click the download button above to get GlanusAgent.pkg</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">2</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Run the installer</h3>
                                    <p className="text-sm text-slate-400">Double-click GlanusAgent.pkg and follow the installation steps</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">3</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Grant system permissions</h3>
                                    <p className="text-sm text-slate-400">Allow Glanus in System Settings → Privacy & Security</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">4</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Verify connection</h3>
                                    <p className="text-sm text-slate-400">Check the menu bar for the Glanus icon or visit your agents dashboard</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {platform === 'linux' && (
                        <div className="space-y-4">
                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">1</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Download the package</h3>
                                    <p className="text-sm text-slate-400">Click the download button above to get glanus-agent.deb</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">2</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Install via terminal</h3>
                                    <div className="mt-2 p-3 bg-slate-950 text-health-good rounded font-mono text-sm">
                                        sudo dpkg -i glanus-agent.deb
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">3</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Start the service</h3>
                                    <div className="mt-2 p-3 bg-slate-950 text-health-good rounded font-mono text-sm">
                                        sudo systemctl start glanus-agent<br />
                                        sudo systemctl enable glanus-agent
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-nerve text-white rounded-full flex items-center justify-center font-semibold">4</span>
                                <div>
                                    <h3 className="font-semibold mb-1">Verify connection</h3>
                                    <div className="mt-2 p-3 bg-slate-950 text-health-good rounded font-mono text-sm">
                                        systemctl status glanus-agent
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* What the Agent Does */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-8 mb-8">
                    <h2 className="text-2xl font-semibold mb-6">What the Agent Does</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold text-lg mb-2">✅ Monitoring</h3>
                            <ul className="text-sm text-slate-400 space-y-1">
                                <li>• Real-time CPU, RAM, and Disk usage</li>
                                <li>• Network activity tracking</li>
                                <li>• Running process monitoring</li>
                                <li>• Temperature sensors (if available)</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2">🔧 Management</h3>
                            <ul className="text-sm text-slate-400 space-y-1">
                                <li>• Remote script execution</li>
                                <li>• Automated maintenance tasks</li>
                                <li>• Software inventory</li>
                                <li>• Auto-updates (silent, no restart)</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2">🔒 Security</h3>
                            <ul className="text-sm text-slate-400 space-y-1">
                                <li>• Encrypted communication</li>
                                <li>• Secure authentication tokens</li>
                                <li>• Sandboxed script execution</li>
                                <li>• Full audit logging</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2">⚡ Performance</h3>
                            <ul className="text-sm text-slate-400 space-y-1">
                                <li>• &lt;2% CPU usage (idle)</li>
                                <li>• &lt;50MB RAM footprint</li>
                                <li>• Offline queueing for reliability</li>
                                <li>• Batched metric uploads</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* System Requirements */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-8">
                    <h2 className="text-2xl font-semibold mb-6">System Requirements</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <h3 className="font-semibold mb-2">Windows</h3>
                            <ul className="text-sm text-slate-400 space-y-1">
                                <li>• Windows 10 or 11</li>
                                <li>• 100MB disk space</li>
                                <li>• Admin rights (install only)</li>
                                <li>• Internet connection</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">macOS</h3>
                            <ul className="text-sm text-slate-400 space-y-1">
                                <li>• macOS 12 (Monterey) or later</li>
                                <li>• 100MB disk space</li>
                                <li>• Admin rights (install only)</li>
                                <li>• Internet connection</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">Linux</h3>
                            <ul className="text-sm text-slate-400 space-y-1">
                                <li>• Ubuntu 20.04+ or Debian 11+</li>
                                <li>• 100MB disk space</li>
                                <li>• Root access (install only)</li>
                                <li>• Internet connection</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Help Link */}
                <div className="mt-8 text-center">
                    <Link
                        href={`/workspaces/${workspaceId}/agents`}
                        className="text-nerve hover:underline"
                    >
                        View Connected Agents →
                    </Link>
                </div>
            </div>
        </>
    );
}
