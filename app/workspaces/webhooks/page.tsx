'use client';

import { useState, useEffect } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { Webhook, Eye, EyeOff, Save, Trash2, RefreshCw, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { SkeletonDashboard } from '@/components/ui/Skeleton';

interface WebhookConfig {
    id: string;
    url: string;
    enabled: boolean;
    secret: string | null;
    createdAt: string;
    updatedAt: string;
}

export default function WebhooksPage() {
    const workspaceId = useWorkspaceId();
    const { success: toastSuccess, error: toastError } = useToast();

    const [webhook, setWebhook] = useState<WebhookConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [url, setUrl] = useState('');
    const [enabled, setEnabled] = useState(true);
    const [secret, setSecret] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [copied, setCopied] = useState(false);

    const fetchWebhook = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/webhook`);
            if (!res.ok) throw new Error('Failed to fetch webhook');
            const data = await res.json();
            const wh = data.data?.webhook || null;
            setWebhook(wh);
            if (wh) {
                setUrl(wh.url);
                setEnabled(wh.enabled);
                setSecret(wh.secret || '');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (workspaceId) fetchWebhook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    const handleSave = async () => {
        if (!url.trim()) {
            toastError('Validation Error', 'Webhook URL is required.');
            return;
        }
        try {
            new URL(url);
        } catch {
            toastError('Validation Error', 'Please enter a valid URL.');
            return;
        }

        setIsSaving(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.trim(),
                    enabled,
                    ...(secret.trim() && { secret: secret.trim() }),
                }),
            });
            if (!res.ok) throw new Error('Failed to save webhook');
            toastSuccess('Webhook Saved', webhook ? 'Webhook configuration updated.' : 'Webhook endpoint registered.');
            fetchWebhook();
        } catch {
            toastError('Error', 'Could not save webhook configuration.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!webhook) return;
        setIsDeleting(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/webhook`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete webhook');
            toastSuccess('Webhook Deleted', 'Webhook endpoint removed.');
            setWebhook(null);
            setUrl('');
            setSecret('');
            setEnabled(true);
        } catch {
            toastError('Error', 'Could not delete webhook.');
        } finally {
            setIsDeleting(false);
        }
    };

    const generateSecret = () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const newSecret = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
        setSecret(newSecret);
    };

    const copySecret = () => {
        navigator.clipboard.writeText(secret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) return <SkeletonDashboard />;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Webhook Configuration</h1>
                    <p className="text-muted-foreground">
                        Receive real-time notifications via HTTP POST when events occur in this workspace.
                    </p>
                </div>
                <button onClick={fetchWebhook} disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-2 text-foreground rounded-xl hover:bg-surface-3 transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl">
                    <p className="font-medium">Error loading webhook</p>
                    <p className="text-sm opacity-80">{error}</p>
                </div>
            )}

            {/* Status Banner */}
            {webhook && (
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${webhook.enabled
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/5 border-amber-500/20 text-warning'
                    }`}>
                    {webhook.enabled ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <div>
                        <p className="font-semibold text-sm">
                            {webhook.enabled ? 'Webhook Active' : 'Webhook Paused'}
                        </p>
                        <p className="text-xs opacity-70">
                            {webhook.enabled
                                ? 'Events are being delivered to your endpoint.'
                                : 'Webhook is configured but not currently delivering events.'}
                        </p>
                    </div>
                </div>
            )}

            {/* Configuration Form */}
            <div className="bg-surface-1 border border-border rounded-xl divide-y divide-border">
                {/* Endpoint URL */}
                <div className="p-6">
                    <label className="block text-sm font-semibold text-foreground mb-2">
                        Endpoint URL
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                        Events will be sent as HTTP POST requests to this URL with a JSON payload.
                    </p>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://your-server.com/webhook"
                        className="w-full px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                    />
                </div>

                {/* Enabled Toggle */}
                <div className="p-6 flex items-center justify-between">
                    <div>
                        <label className="text-sm font-semibold text-foreground">Enabled</label>
                        <p className="text-xs text-muted-foreground mt-1">
                            Toggle webhook delivery on or off without deleting the configuration.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setEnabled(!enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-surface-3'
                            }`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                    </button>
                </div>

                {/* Signing Secret */}
                <div className="p-6">
                    <label className="block text-sm font-semibold text-foreground mb-2">
                        Signing Secret
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                        Used to generate HMAC-SHA256 signatures for verifying webhook authenticity. Include in the <code className="text-primary">X-Glanus-Signature</code> header.
                    </p>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type={showSecret ? 'text' : 'password'}
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                                placeholder="Enter or generate a signing secret..."
                                className="w-full px-4 py-2.5 pr-20 bg-surface-2 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                <button onClick={() => setShowSecret(!showSecret)}
                                    className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                                    title={showSecret ? 'Hide' : 'Show'}
                                    aria-label={showSecret ? 'Hide webhook secret' : 'Show webhook secret'}>
                                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                {secret && (
                                    <button onClick={copySecret}
                                        className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                                        title="Copy"
                                        aria-label="Copy webhook secret">
                                        {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                )}
                            </div>
                        </div>
                        <button onClick={generateSecret}
                            className="px-4 py-2.5 text-xs font-medium bg-surface-2 border border-border rounded-xl hover:bg-surface-3 transition-colors text-muted-foreground whitespace-nowrap">
                            Generate
                        </button>
                    </div>
                </div>

                {/* Event Info */}
                <div className="p-6">
                    <label className="block text-sm font-semibold text-foreground mb-2">
                        Delivered Events
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                        The following event types are delivered when triggered:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {['asset.created', 'asset.updated', 'asset.deleted', 'alert.triggered', 'agent.connected', 'agent.disconnected',
                            'member.added', 'member.removed', 'session.started', 'session.ended', 'reflex.triggered', 'maintenance.started'].map(event => (
                                <span key={event} className="text-xs font-mono px-2.5 py-1.5 bg-surface-2 border border-border/50 rounded-md text-muted-foreground">
                                    {event}
                                </span>
                            ))}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
                <div>
                    {webhook && (
                        <button onClick={handleDelete} disabled={isDeleting}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-destructive/30 text-destructive rounded-xl hover:bg-destructive/10 transition-colors disabled:opacity-50">
                            <Trash2 className="w-4 h-4" />
                            {isDeleting ? 'Deleting...' : 'Delete Webhook'}
                        </button>
                    )}
                </div>
                <button onClick={handleSave} disabled={isSaving || !url.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-primary text-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-lg shadow-primary/20">
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : webhook ? 'Update Webhook' : 'Register Webhook'}
                </button>
            </div>

            {/* Signature Verification Guide */}
            <div className="bg-surface-1 border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-primary" />
                    How to Verify Signatures
                </h3>
                <pre className="text-xs text-muted-foreground bg-surface-2 p-4 rounded-xl overflow-x-auto font-mono leading-relaxed">
                    {`const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature), 
    Buffer.from(expected)
  );
}

// In your handler:
const sig = req.headers['x-glanus-signature'];
const isValid = verifySignature(
  JSON.stringify(req.body), sig, YOUR_SECRET
);`}
                </pre>
            </div>
        </div>
    );
}
