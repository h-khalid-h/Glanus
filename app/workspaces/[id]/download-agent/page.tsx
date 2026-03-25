'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/lib/toast';

import { CheckCircle2, Copy } from 'lucide-react';

export default function DownloadAgentPage() {
    const params = useParams();
    const workspaceId = params?.id as string;

    const { error: showError, success: showSuccess } = useToast();
    const [platform, setPlatform] = useState<'windows' | 'macos' | 'linux'>('windows');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [downloadInfo, setDownloadInfo] = useState<{
        downloadUrl: string;
        preAuthToken: string;
        expiresAt: string;
        apiEndpoint: string;
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
            setDownloadInfo({
                downloadUrl: data.downloadUrl,
                preAuthToken: data.preAuthToken,
                expiresAt: data.expiresAt,
                apiEndpoint: data.config?.apiEndpoint ?? window.location.origin
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Download generation failed';
            showError('Error', msg);
            setError(msg);
        } finally {
            setGenerating(false);
        }
    };

    const handleCopy = () => {
        if (!downloadInfo) return;

        const hostUrl = window.location.origin;
        let command = '';

        switch (platform) {
            case 'windows':
                command = `Invoke-WebRequest -Uri "${hostUrl}${downloadInfo.downloadUrl}" -OutFile "GlanusAgent.msi"; Start-Process -Wait -FilePath "msiexec.exe" -ArgumentList "/i GlanusAgent.msi PRE_AUTH_TOKEN=${downloadInfo.preAuthToken} API_ENDPOINT=${downloadInfo.apiEndpoint} /quiet"`;
                break;
            case 'macos':
                command = `curl -sSL ${hostUrl}${downloadInfo.downloadUrl} -o GlanusAgent.pkg && sudo installer -pkg GlanusAgent.pkg -target / && sudo /Library/Application\\ Support/Glanus/agent-register --token "${downloadInfo.preAuthToken}" --url "${downloadInfo.apiEndpoint}"`;
                break;
            case 'linux':
                command = `curl -sSL ${hostUrl}/install-linux.sh | sudo bash -s -- --token "${downloadInfo.preAuthToken}" --url "${downloadInfo.apiEndpoint}"`;
                break;
        }

        navigator.clipboard.writeText(command);
        showSuccess('Command Copied', 'Paste this command into your terminal to deploy.');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const triggerManualDownload = () => {
        if (downloadInfo?.downloadUrl) {
            const a = document.createElement('a');
            a.href = downloadInfo.downloadUrl;
            a.download = '';
            a.click();
        }
    };


    if (error) return <ErrorState title="Something went wrong" description={error} onRetry={() => window.location.reload()} />;

    return (
        <>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="text-6xl mb-4">📡</div>
                    <h1 className="text-4xl font-bold text-foreground mb-2">Deploy Glanus Agent</h1>
                    <p className="text-lg text-muted-foreground">
                        Generate 1-click deployment scripts to onboard new agents.
                    </p>
                </div>

                {/* Main View */}
                {!downloadInfo ? (
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
                                <p className="text-sm text-slate-400">PowerShell</p>
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
                                <p className="text-sm text-slate-400">Terminal (zsh/bash)</p>
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
                                <p className="text-sm text-slate-400">Terminal (bash/sh)</p>
                            </button>
                        </div>

                        <button type="button"
                            onClick={generateDownloadLink}
                            disabled={generating}
                            className="w-full py-4 bg-nerve text-white rounded-lg font-semibold text-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            {generating && (
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            )}
                            {generating ? 'Generating Secure Link...' : `Generate Deploy Script for ${platform === 'windows' ? 'Windows' : platform === 'macos' ? 'macOS' : 'Linux'}`}
                        </button>
                    </div>
                ) : (
                    <div className="rounded-xl border border-nerve/30 bg-nerve/5 backdrop-blur-sm p-8 mb-8 animate-in fade-in zoom-in duration-300">
                        <h2 className="text-2xl font-semibold text-foreground mb-2">Deployment Script Generated</h2>
                        <p className="text-muted-foreground mb-6">Paste this command into your target machine's {platform === 'windows' ? 'Administrator PowerShell' : 'Terminal'}. It will silently download the agent and authenticate it to this Workspace.</p>

                        <div className="relative group">
                            <pre className="bg-slate-950 text-slate-300 p-4 rounded-xl font-mono text-sm overflow-x-auto whitespace-pre-wrap break-all border border-slate-800">
                                {platform === 'windows' && `Invoke-WebRequest -Uri "${window.location.origin}${downloadInfo.downloadUrl}" -OutFile "GlanusAgent.msi"\nStart-Process -Wait -FilePath "msiexec.exe" -ArgumentList "/i GlanusAgent.msi PRE_AUTH_TOKEN=${downloadInfo.preAuthToken} API_ENDPOINT=${downloadInfo.apiEndpoint} /quiet"`}
                                {platform === 'macos' && `curl -sSL ${window.location.origin}${downloadInfo.downloadUrl} -o GlanusAgent.pkg && \\\nsudo installer -pkg GlanusAgent.pkg -target / && \\\nsudo /Library/Application\\ Support/Glanus/agent-register --token "${downloadInfo.preAuthToken}" --url "${downloadInfo.apiEndpoint}"`}
                                {platform === 'linux' && `curl -sSL ${window.location.origin}/install-linux.sh | sudo bash -s -- --token "${downloadInfo.preAuthToken}" --url "${downloadInfo.apiEndpoint}"`}
                            </pre>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                {copied ? <CheckCircle2 className="w-4 h-4 text-health-good" /> : <Copy className="w-4 h-4" />}
                                <span className="text-xs font-semibold">{copied ? 'Copied!' : 'Copy'}</span>
                            </button>
                        </div>

                        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 py-4 px-6 bg-surface-1 rounded-lg border border-border">
                            <div className="text-sm">
                                <p className="text-muted-foreground">
                                    <span className="text-foreground font-medium">Auth Token:</span>{' '}
                                    <span className="font-mono">
                                        {copied ? downloadInfo.preAuthToken : '•'.repeat(Math.min(downloadInfo.preAuthToken.length, 32))}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCopied(prev => !prev)}
                                        className="ml-2 text-nerve hover:underline text-xs"
                                    >
                                        {copied ? 'Hide' : 'Reveal'}
                                    </button>
                                </p>
                                <p className="text-muted-foreground/70 text-xs mt-1">Expires in 7 days</p>
                            </div>
                            <button
                                type="button"
                                onClick={triggerManualDownload}
                                className="px-4 py-2 text-sm font-semibold bg-surface-2 hover:bg-surface-3 text-foreground rounded-lg whitespace-nowrap"
                            >
                                Download Binary Manually
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setDownloadInfo(null)}
                            className="w-full text-center text-sm text-nerve hover:underline mt-6"
                        >
                            ← Back to Platform Selection
                        </button>
                    </div>
                )}


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
