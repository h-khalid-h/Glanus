'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';

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
    const params = useParams();
    const router = useRouter();
    const workspaceId = params?.id as string;

    const [rules, setRules] = useState<AlertRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
    const [saving, setSaving] = useState(false);

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
        if (workspaceId) fetchRules();
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
            await csrfFetch(`/api/workspaces/${workspaceId}/alerts/${editingRule.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingRule),
            });
            setRules(prev => prev.map(r =>
                r.id === editingRule.id ? editingRule : r
            ));
            setEditingRule(null);
        } catch (err: unknown) {
            showError('Failed to save rule:', err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900/30 py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
                    <div className="h-4 w-96 animate-pulse rounded bg-surface-2" />
                    <div className="space-y-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-2" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-900/30 py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="card flex flex-col items-center justify-center min-h-[300px]">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                            <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-destructive mb-1">Unable to load alerts</p>
                        <p className="text-xs text-muted-foreground mb-4">{error}</p>
                        <button onClick={() => window.location.reload()} className="btn-primary text-sm">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900/30 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push(`/workspaces/${workspaceId}/agents`)}
                        className="text-sm text-nerve hover:underline mb-4"
                    >
                        ← Back to Agents
                    </button>
                    <h1 className="text-3xl font-bold text-white mb-2">Alert Configuration</h1>
                    <p className="text-slate-400">Configure monitoring alerts for all agents in this workspace</p>
                </div>

                {/* Info Box */}
                <div className="mb-8 bg-nerve/5 border border-nerve/20 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-nerve mb-2">How Alerts Work</h3>
                    <ul className="list-disc list-inside space-y-1 text-nerve text-sm">
                        <li>Alerts trigger when thresholds are exceeded for the specified duration</li>
                        <li>Email notifications sent to all workspace admins</li>
                        <li>Webhooks can be configured for integration with Slack, PagerDuty, etc.</li>
                        <li>Alerts auto-resolve when metrics return to normal</li>
                    </ul>
                </div>

                {/* Alert Rules */}
                <div className="space-y-4">
                    {rules.length === 0 && (
                        <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/10">
                            <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                                <Bell className="w-6 h-6 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No Alert Rules Configured</h3>
                            <p className="text-sm text-slate-500 max-w-sm mx-auto">
                                You haven't set up any monitoring alerts for this workspace yet.
                            </p>
                        </div>
                    )}
                    {rules.map((rule) => (
                        <div key={rule.id} className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <h3 className="text-lg font-semibold text-white">{rule.name}</h3>
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${rule.enabled ? 'bg-health-good/15 text-health-good' : 'bg-slate-800/50 text-slate-200'
                                            }`}>
                                            {rule.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>

                                    <div className="text-sm text-slate-400 space-y-1">
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
                                    <button
                                        onClick={() => setEditingRule(rule)}
                                        className="px-4 py-2 text-sm text-nerve hover:bg-nerve/5 rounded-md transition"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => toggleRule(rule.id)}
                                        className={`px-4 py-2 text-sm rounded-md transition ${rule.enabled
                                            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            : 'bg-health-good text-white hover:bg-health-good/80'
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
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm max-w-2xl w-full p-6">
                            <h2 className="text-2xl font-bold mb-6">Edit Alert Rule</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Rule Name
                                    </label>
                                    <input
                                        type="text"
                                        value={editingRule.name}
                                        onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Metric
                                    </label>
                                    <select
                                        value={editingRule.metric}
                                        onChange={(e) => setEditingRule({ ...editingRule, metric: e.target.value as AlertRule['metric'] })}
                                        className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                    >
                                        <option value="cpu">CPU Usage</option>
                                        <option value="ram">RAM Usage</option>
                                        <option value="disk">Disk Usage</option>
                                        <option value="offline">Agent Offline</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Threshold ({getMetricUnit(editingRule.metric)})
                                    </label>
                                    <input
                                        type="number"
                                        value={editingRule.threshold}
                                        onChange={(e) => setEditingRule({ ...editingRule, threshold: parseInt(e.target.value) })}
                                        min="0"
                                        max={editingRule.metric === 'offline' ? '1440' : '100'}
                                        className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Duration (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        value={editingRule.duration}
                                        onChange={(e) => setEditingRule({ ...editingRule, duration: parseInt(e.target.value) })}
                                        min="0"
                                        max="60"
                                        className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Alert triggers after metric exceeds threshold for this long (0 = immediate)
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={editingRule.notifyEmail}
                                            onChange={(e) => setEditingRule({ ...editingRule, notifyEmail: e.target.checked })}
                                            className="w-4 h-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                                        />
                                        <span className="ml-2 text-sm text-slate-300">Send email notifications</span>
                                    </label>

                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={editingRule.notifyWebhook}
                                            onChange={(e) => setEditingRule({ ...editingRule, notifyWebhook: e.target.checked })}
                                            className="w-4 h-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                                        />
                                        <span className="ml-2 text-sm text-slate-300">Send webhook notifications</span>
                                    </label>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end space-x-3">
                                <button
                                    onClick={() => setEditingRule(null)}
                                    className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800/50 rounded-md transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveRule}
                                    disabled={saving}
                                    className="px-4 py-2 text-sm bg-nerve text-white rounded-md hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Webhook Configuration */}
                <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                    <h2 className="text-xl font-semibold mb-4">Webhook Configuration</h2>
                    <p className="text-sm text-slate-400 mb-4">
                        Configure webhook URL to receive alert notifications via HTTP POST
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Webhook URL
                            </label>
                            <input
                                type="url"
                                placeholder="https://hooks.slack.com/services/..."
                                className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                            />
                        </div>

                        <button className="px-4 py-2 bg-nerve text-white rounded-md hover:brightness-110 transition">
                            Save Webhook
                        </button>
                    </div>

                    <div className="mt-4 p-4 bg-slate-900/30 rounded-md">
                        <p className="text-xs text-slate-400 font-medium mb-2">Example Payload:</p>
                        <pre className="text-xs text-slate-200 overflow-x-auto">
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
        </div>
    );
}
