'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceId } from '@/lib/workspace/context';
import { Bell } from 'lucide-react';
import { ErrorState } from '@/components/ui/EmptyState';

interface AlertRule {
    id: string;
    name: string;
    enabled: boolean;
    metric: 'cpu' | 'ram' | 'disk' | 'offline';
    threshold: number;
    duration: number; // minutes
    notifyEmail: boolean;
    notifyWebhook: boolean;
}

export default function WorkspaceAlertsPage() {
    const { error: showError } = useToast();
    const router = useRouter();
    const workspaceId = useWorkspaceId();

    const [rules, setRules] = useState<AlertRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState('');
    const [savingWebhook, setSavingWebhook] = useState(false);

    const [activeTab, setActiveTab] = useState<'inbox' | 'configuration'>('inbox');
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

    useEffect(() => {
        const fetchRules = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const res = await csrfFetch(`/api/workspaces/${workspaceId}/alerts`);
                if (!res.ok) throw new Error('Failed to fetch alert rules');
                const data = await res.json();
                setRules(data.data?.rules || data.rules || []);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Something went wrong');
            } finally {
                setIsLoading(false);
            }
        };

        const fetchNotifications = async () => {
            try {
                setIsLoadingNotifications(true);
                const res = await csrfFetch(`/api/workspaces/${workspaceId}/notifications`);
                if (!res.ok) throw new Error('Failed to fetch notifications');
                const data = await res.json();
                setNotifications(data.data?.notifications || data.notifications || []);
            } catch (err) {
                console.error('Failed to load notifications stream:', err);
            } finally {
                setIsLoadingNotifications(false);
            }
        };

        if (workspaceId) {
            fetchRules();
            fetchNotifications();
        }
    }, [workspaceId]);

    const getMetricLabel = (metric: string) => {
        switch (metric) {
            case 'cpu': return 'CPU Usage';
            case 'ram': return 'RAM Usage';
            case 'disk': return 'Disk Usage';
            case 'offline': return 'Agent Offline';
            default: return metric;
        }
    };

    const getMetricUnit = (metric: string) => {
        return metric === 'offline' ? 'minutes' : '%';
    };

    const toggleRule = async (ruleId: string) => {
        const rule = rules.find(r => r.id === ruleId);
        if (!rule) return;
        setRules(prev => prev.map(r =>
            r.id === ruleId ? { ...r, enabled: !r.enabled } : r
        ));
        try {
            await csrfFetch(`/api/workspaces/${workspaceId}/alerts/${ruleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !rule.enabled }),
            });
        } catch (err: unknown) {
            showError('Failed to toggle rule:', err instanceof Error ? err.message : 'An unexpected error occurred');
            setRules(prev => prev.map(r =>
                r.id === ruleId ? { ...r, enabled: rule.enabled } : r
            ));
        }
    };

    const saveRule = async () => {
        if (!editingRule) return;

        setSaving(true);
        try {
            if (isCreating) {
                // Create new rule via POST
                const res = await csrfFetch(`/api/workspaces/${workspaceId}/alerts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editingRule),
                });
                if (!res.ok) throw new Error('Failed to create rule');
                const data = await res.json();
                const newRule = data.data?.rule || data.rule || { ...editingRule, id: crypto.randomUUID() };
                setRules(prev => [...prev, newRule]);
            } else {
                // Update existing rule via PATCH
                await csrfFetch(`/api/workspaces/${workspaceId}/alerts/${editingRule.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editingRule),
                });
                setRules(prev => prev.map(r =>
                    r.id === editingRule.id ? editingRule : r
                ));
            }
            setEditingRule(null);
            setIsCreating(false);
        } catch (err: unknown) {
            showError('Failed to save rule:', err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    };

    const createNewRule = () => {
        setActiveTab('configuration'); // Force switch to configuration tab
        setIsCreating(true);
        setEditingRule({
            id: '',
            name: '',
            enabled: true,
            metric: 'cpu',
            threshold: 90,
            duration: 5,
            notifyEmail: true,
            notifyWebhook: false,
        });
    };

    const saveWebhook = async () => {
        setSavingWebhook(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/alerts/webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: webhookUrl }),
            });
            if (!res.ok) throw new Error('Failed to save webhook');
        } catch (err: unknown) {
            showError('Failed to save webhook:', err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setSavingWebhook(false);
        }
    };

    if (isLoading) {
        return (
            <>
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="h-8 w-64 animate-pulse rounded-xl bg-surface-2" />
                    <div className="h-4 w-96 animate-pulse rounded bg-surface-2" />
                    <div className="space-y-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-2" />
                        ))}
                    </div>
                </div>
            </>
        );
    }

    if (error) {
        return <ErrorState title="Unable to load alerts" description={error} onRetry={() => window.location.reload()} />;
    }

    // Helper for rendering the unified inbox stream icon
    const getNotificationColor = (type: string, action: string) => {
        if (type === 'insight') return 'bg-oracle/10 text-oracle';
        if (action.includes('delete') || action.includes('removed')) return 'bg-destructive/10 text-destructive';
        if (action.includes('create') || action.includes('added')) return 'bg-reflex/10 text-reflex';
        if (action.includes('invite')) return 'bg-cortex/10 text-cortex';
        return 'bg-primary/10 text-primary';
    };

    const getNotificationIcon = (type: string, action: string) => {
        if (type === 'insight') return '🔮';
        if (action.includes('delete') || action.includes('removed')) return '✕';
        if (action.includes('create') || action.includes('added')) return '＋';
        if (action.includes('invite')) return '↗';
        if (action.includes('update') || action.includes('edit')) return '↻';
        return '•';
    };

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <button type="button"
                    onClick={() => router.push(`/workspaces/agents`)}
                    className="text-sm text-primary hover:underline mb-4"
                >
                    ← Back to Agents
                </button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground mb-2">Notifications Hub</h1>
                        <p className="text-muted-foreground">Monitor workspace activity and configure threshold alerts</p>
                    </div>
                    <button type="button"
                        onClick={createNewRule}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all hover:shadow-lg hover:shadow-primary/20"
                    >
                        <Bell className="w-4 h-4" />
                        Create Alert Rule
                    </button>
                </div>
            </div>

            {/* Custom Tab Bar */}
            <div className="flex space-x-1 border-b border-border mb-8">
                <button
                    onClick={() => setActiveTab('inbox')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'inbox'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                        }`}
                >
                    Inbox Feed
                </button>
                <button
                    onClick={() => setActiveTab('configuration')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'configuration'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                        }`}
                >
                    Configuration & Rules
                    {rules.filter(r => r.enabled).length > 0 && (
                        <span className="bg-muted text-foreground text-xs px-2 py-0.5 rounded-full">
                            {rules.filter(r => r.enabled).length} Active
                        </span>
                    )}
                </button>
            </div>

            {/* Inbox Tab Content */}
            {activeTab === 'inbox' && (
                <div className="space-y-4">
                    {isLoadingNotifications ? (
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-2" />
                            ))}
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="text-center py-16 px-4 rounded-xl border border-border bg-surface-1/10">
                            <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                                <Bell className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground mb-2">Inbox is Clear</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                You have no new notifications or alerts for this workspace.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-border bg-card backdrop-blur-sm divide-y divide-border/50">
                            {notifications.map((item) => {
                                const actionStr = (item.action || '').toLowerCase();
                                return (
                                <div key={item.id} className="p-4 hover:bg-muted/30 transition-colors flex items-start gap-4">
                                    <div className={`mt-1 shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${getNotificationColor(item.type, actionStr)}`}>
                                        {getNotificationIcon(item.type, actionStr)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-sm font-medium text-foreground">
                                                {item.type === 'insight' ? item.action : `${item.actor} performed: ${item.action}`}
                                            </p>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                                                {new Date(item.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        {item.assetName && (
                                            <p className="text-xs text-muted-foreground">
                                                Target: <span className="font-medium text-foreground">{item.assetName}</span>
                                            </p>
                                        )}
                                        {item.type === 'insight' && item.metadata?.severity && (
                                            <p className="text-xs mt-1">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase
                                                    ${item.metadata.severity === 'CRITICAL' ? 'bg-destructive/20 text-destructive' : 'bg-oracle/20 text-oracle'}
                                                `}>
                                                    {item.metadata.severity} Risk
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Configuration Tab Content */}
            {activeTab === 'configuration' && (
                <div className="animate-in fade-in duration-300">
                    {/* Info Box */}
                    <div className="mb-8 bg-primary/5 border border-primary/20 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-primary mb-2">How Alerts Work</h3>
                        <ul className="list-disc list-inside space-y-1 text-primary text-sm">
                            <li>Alerts trigger when thresholds are exceeded for the specified duration</li>
                            <li>Email notifications sent to all workspace admins</li>
                            <li>Webhooks can be configured for integration with Slack, PagerDuty, etc.</li>
                            <li>Alerts auto-resolve when metrics return to normal</li>
                        </ul>
                    </div>

                    {/* Alert Rules */}
                    <div className="space-y-4">
                        {rules.length === 0 && (
                            <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed border-border bg-surface-1/10">
                                <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                                    <Bell className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground mb-2">No Alert Rules Configured</h3>
                                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                    You haven't set up any monitoring alerts for this workspace yet.
                                </p>
                            </div>
                        )}
                        {rules.map((rule) => (
                            <div key={rule.id} className="rounded-xl border border-border bg-card backdrop-blur-sm p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <h3 className="text-lg font-semibold text-foreground">{rule.name}</h3>
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${rule.enabled ? 'bg-health-good/15 text-health-good' : 'bg-muted/50 text-foreground'
                                                }`}>
                                                {rule.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>

                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <p>
                                                <span className="font-medium">Trigger:</span> {getMetricLabel(rule.metric)} {' '}
                                                {rule.metric === 'offline' ? 'for more than' : '>'} {' '}
                                                {rule.threshold}{getMetricUnit(rule.metric)}
                                                {rule.duration > 0 && ` for ${rule.duration} minutes`}
                                            </p>
                                            <p>
                                                <span className="font-medium">Notifications:</span>{' '}
                                                {rule.notifyEmail && 'Email'}{' '}
                                                {rule.notifyEmail && rule.notifyWebhook && '• '}{' '}
                                                {rule.notifyWebhook && 'Webhook'}
                                                {!rule.notifyEmail && !rule.notifyWebhook && 'None'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2 ml-4">
                                        <button type="button"
                                            onClick={() => setEditingRule(rule)}
                                            className="px-4 py-2 text-sm text-primary hover:bg-primary/5 rounded-md transition"
                                        >
                                            Edit
                                        </button>
                                        <button type="button"
                                            onClick={() => toggleRule(rule.id)}
                                            className={`px-4 py-2 text-sm rounded-md transition ${rule.enabled
                                                ? 'bg-muted text-foreground hover:bg-muted'
                                                : 'bg-health-good text-foreground hover:bg-health-good/80'
                                                }`}
                                        >
                                            {rule.enabled ? 'Disable' : 'Enable'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Edit Modal */}
                    {editingRule && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                            <div className="rounded-xl border border-border bg-card/95 backdrop-blur-xl max-w-2xl w-full p-6">
                                <h2 className="text-2xl font-bold text-foreground mb-6">{isCreating ? 'Create Alert Rule' : 'Edit Alert Rule'}</h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-2">
                                            Rule Name
                                        </label>
                                        <input
                                            type="text"
                                            value={editingRule.name}
                                            onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                                            className="w-full px-4 py-2 border border-border rounded-xl bg-muted/50 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/30 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-2">
                                            Metric
                                        </label>
                                        <select
                                            value={editingRule.metric}
                                            onChange={(e) => setEditingRule({ ...editingRule, metric: e.target.value as AlertRule['metric'] })}
                                            className="w-full px-4 py-2 border border-border rounded-xl bg-muted/50 text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/30 focus:outline-none"
                                        >
                                            <option value="cpu">CPU Usage</option>
                                            <option value="ram">RAM Usage</option>
                                            <option value="disk">Disk Usage</option>
                                            <option value="offline">Agent Offline</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-2">
                                            Threshold ({getMetricUnit(editingRule.metric)})
                                        </label>
                                        <input
                                            type="number"
                                            value={editingRule.threshold}
                                            onChange={(e) => setEditingRule({ ...editingRule, threshold: parseInt(e.target.value) })}
                                            min="0"
                                            max={editingRule.metric === 'offline' ? '1440' : '100'}
                                            className="w-full px-4 py-2 border border-border rounded-xl bg-muted/50 text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/30 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-2">
                                            Duration (minutes)
                                        </label>
                                        <input
                                            type="number"
                                            value={editingRule.duration}
                                            onChange={(e) => setEditingRule({ ...editingRule, duration: parseInt(e.target.value) })}
                                            min="0"
                                            max="60"
                                            className="w-full px-4 py-2 border border-border rounded-xl bg-muted/50 text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/30 focus:outline-none"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Alert triggers after metric exceeds threshold for this long (0 = immediate)
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={editingRule.notifyEmail}
                                                onChange={(e) => setEditingRule({ ...editingRule, notifyEmail: e.target.checked })}
                                                className="w-4 h-4 text-primary border-border rounded focus:ring-primary/50"
                                            />
                                            <span className="ml-2 text-sm text-foreground">Send email notifications</span>
                                        </label>

                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={editingRule.notifyWebhook}
                                                onChange={(e) => setEditingRule({ ...editingRule, notifyWebhook: e.target.checked })}
                                                className="w-4 h-4 text-primary border-border rounded focus:ring-primary/50"
                                            />
                                            <span className="ml-2 text-sm text-foreground">Send webhook notifications</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end space-x-3">
                                    <button type="button"
                                        onClick={() => setEditingRule(null)}
                                        className="px-4 py-2 text-sm text-foreground hover:bg-muted/50 rounded-md transition"
                                    >
                                        Cancel
                                    </button>
                                    <button type="button"
                                        onClick={saveRule}
                                        disabled={saving}
                                        className="px-4 py-2 text-sm bg-primary text-foreground rounded-md hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Webhook Configuration */}
                    <div className="mt-8 rounded-xl border border-border bg-card backdrop-blur-sm p-6">
                        <h2 className="text-xl font-semibold mb-4">Webhook Configuration</h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            Configure webhook URL to receive alert notifications via HTTP POST
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Webhook URL
                                </label>
                                <input
                                    type="url"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    placeholder="https://hooks.slack.com/services/..."
                                    className="w-full px-4 py-2 border border-border rounded-xl bg-muted/50 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/30 focus:outline-none"
                                />
                            </div>

                            <button type="button"
                                onClick={saveWebhook}
                                disabled={savingWebhook || !webhookUrl}
                                className="px-4 py-2 bg-primary text-foreground rounded-xl hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savingWebhook ? 'Saving...' : 'Save Webhook'}
                            </button>
                        </div>

                        <div className="mt-4 p-4 bg-muted/30 rounded-md">
                            <p className="text-xs text-muted-foreground font-medium mb-2">Example Payload:</p>
                            <pre className="text-xs text-foreground overflow-x-auto">
                                {`{
  "alert": "High CPU Usage",
  "asset": "Server-01",
  "metric": "cpu",
  "value": 95.2,
  "threshold": 90,
  "timestamp": "2026-02-16T00:00:00Z"
}`}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
