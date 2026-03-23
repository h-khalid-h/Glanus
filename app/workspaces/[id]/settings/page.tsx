'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import {
    Settings, ShieldAlert, AlertTriangle, Building2, Paintbrush,
    Key, Webhook, Bell, Plus, Trash2, Copy, Check,
    Shield, Clock, Globe, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';

interface WorkspaceDetails {
    id: string;
    name: string;
    description: string | null;
    primaryColor: string | null;
    accentColor: string | null;
}

interface ApiKeyEntry {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    lastUsedAt: string | null;
    usageCount: number;
    expiresAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    rawKey?: string; // Only present on creation
}

interface WebhookEntry {
    id: string;
    url: string;
    enabled: boolean;
    secret: string | null;
    lastSuccess: string | null;
    lastFailure: string | null;
    failureCount: number;
    createdAt: string;
}

type SettingsTab = 'general' | 'api-keys' | 'webhooks' | 'notifications';

export default function WorkspaceSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const workspaceId = params.id as string;
    const { success: toastSuccess, error: toastError } = useToast();

    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // General Settings
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [primaryColor, setPrimaryColor] = useState('');
    const [accentColor, setAccentColor] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Delete
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // API Keys
    const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
    const [loadingKeys, setLoadingKeys] = useState(false);
    const [showCreateKey, setShowCreateKey] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
    const [newKeyExpiry, setNewKeyExpiry] = useState('never');
    const [creatingKey, setCreatingKey] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState(false);

    // Webhooks
    const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
    const [loadingWebhooks, setLoadingWebhooks] = useState(false);
    const [showAddWebhook, setShowAddWebhook] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [addingWebhook, setAddingWebhook] = useState(false);
    const [confirmState, setConfirmState] = useState<{ open: boolean; action: (() => void) | null; title: string; message: string }>({ open: false, action: null, title: '', message: '' });

    // Notification Prefs
    const [emailNotifs, setEmailNotifs] = useState(true);
    const [webhookNotifs, setWebhookNotifs] = useState(true);
    const [alertSeverityFilter, setAlertSeverityFilter] = useState('all');

    useEffect(() => {
        if (workspaceId) fetchSettings();
    }, [workspaceId]);

    useEffect(() => {
        if (activeTab === 'api-keys') fetchApiKeys();
        if (activeTab === 'webhooks') fetchWebhooks();
    }, [activeTab, workspaceId]);

    const fetchSettings = async () => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}`);
            if (!res.ok) throw new Error('Failed to load workspace settings');
            const data = await res.json();
            const ws = data.data?.workspace || data.workspace;
            setWorkspace(ws);
            setName(ws.name || '');
            setDescription(ws.description || '');
            setPrimaryColor(ws.primaryColor || '#3B82F6');
            setAccentColor(ws.accentColor || '#10B981');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, primaryColor, accentColor }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update settings');
            }
            toastSuccess('Settings Saved', 'Workspace settings updated successfully.');
        } catch (err: unknown) {
            toastError('Save Failed', err instanceof Error ? err.message : 'Failed to update settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (deleteConfirmText !== workspace?.name) return;
        setIsDeleting(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete workspace');
            setIsDeleteModalOpen(false);
            router.push('/dashboard');
        } catch (err: unknown) {
            toastError('Delete Failed', err instanceof Error ? err.message : 'Failed to delete workspace');
            setIsDeleting(false);
        }
    };

    // ── API Keys ────────────────────────────────
    const fetchApiKeys = useCallback(async () => {
        setLoadingKeys(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/api-keys`);
            const data = await res.json();
            if (res.ok) setApiKeys(data.data?.keys || []);
        } catch {
            toastError('Load Error', 'Failed to fetch API keys');
        } finally {
            setLoadingKeys(false);
        }
    }, [workspaceId]);

    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingKey(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/api-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKeyName, scopes: newKeyScopes, expiresIn: newKeyExpiry }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Failed to create key');
            setNewlyCreatedKey(data.data?.key?.rawKey || null);
            toastSuccess('Key Created', 'Copy the key now — it will not be shown again.');
            setNewKeyName('');
            setNewKeyScopes(['read']);
            setNewKeyExpiry('never');
            fetchApiKeys();
        } catch (err: unknown) {
            toastError('Creation Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setCreatingKey(false);
        }
    };

    const requestRevokeKey = (keyId: string) => {
        setConfirmState({
            open: true,
            title: 'Revoke API Key',
            message: 'Revoke this API key? Applications using it will lose access.',
            action: () => handleRevokeKey(keyId),
        });
    };

    const handleRevokeKey = async (keyId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/api-keys?keyId=${keyId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to revoke key');
            toastSuccess('Revoked', 'API key has been revoked.');
            fetchApiKeys();
        } catch (err: unknown) {
            toastError('Revoke Failed', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const toggleScope = (scope: string) => {
        setNewKeyScopes(prev =>
            prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
        );
    };

    // ── Webhooks ────────────────────────────────
    const fetchWebhooks = useCallback(async () => {
        setLoadingWebhooks(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/webhook`);
            const data = await res.json();
            if (res.ok) setWebhooks(Array.isArray(data.data?.webhooks) ? data.data.webhooks : data.data ? [data.data] : []);
        } catch {
            toastError('Load Error', 'Failed to fetch webhooks');
        } finally {
            setLoadingWebhooks(false);
        }
    }, [workspaceId]);

    const handleAddWebhook = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingWebhook(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: webhookUrl, secret: webhookSecret || undefined }),
            });
            if (!res.ok) throw new Error('Failed to add webhook');
            toastSuccess('Webhook Added', 'Webhook endpoint configured.');
            setShowAddWebhook(false);
            setWebhookUrl('');
            setWebhookSecret('');
            fetchWebhooks();
        } catch (err: unknown) {
            toastError('Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setAddingWebhook(false);
        }
    };

    const requestDeleteWebhook = (webhookId: string) => {
        setConfirmState({
            open: true,
            title: 'Remove Webhook',
            message: 'Remove this webhook endpoint?',
            action: () => handleDeleteWebhook(webhookId),
        });
    };

    const handleDeleteWebhook = async (webhookId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/webhook?webhookId=${webhookId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete webhook');
            toastSuccess('Removed', 'Webhook endpoint removed.');
            fetchWebhooks();
        } catch (err: unknown) {
            toastError('Delete Failed', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    // ── Render ────────────────────────────────

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
                <div className="space-y-4">
                    <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
                    <div className="h-48 animate-pulse rounded-xl bg-surface-2" />
                </div>
            </div>
        );
    }

    if (error || !workspace) {
        return (
            <div className="text-center py-12">
                <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">Access Denied</h3>
                <p className="text-slate-400">You must be the Workspace Owner to view this page.</p>
            </div>
        );
    }

    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        { id: 'general', label: 'General', icon: <Building2 size={16} /> },
        { id: 'api-keys', label: 'API Keys', icon: <Key size={16} /> },
        { id: 'webhooks', label: 'Webhooks', icon: <Webhook size={16} /> },
        { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    ];

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-nerve/10 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-nerve" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Workspace Settings</h1>
                        <p className="text-slate-400">Manage workspace configuration, security, and integrations</p>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-8 bg-slate-900/50 rounded-lg p-1 border border-slate-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                            ? 'bg-nerve text-white shadow-lg shadow-nerve/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ GENERAL TAB ═══ */}
            {activeTab === 'general' && (
                <div className="space-y-8">
                    <form onSubmit={handleSave} className="space-y-8">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-6">
                                <Building2 className="w-5 h-5 text-slate-400" />
                                <h2 className="text-xl font-semibold text-foreground">General Information</h2>
                            </div>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Workspace Name</label>
                                    <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-nerve/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-slate-800 border-slate-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-nerve/50 resize-y" placeholder="A brief description of this organization..." />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-6">
                                <Paintbrush className="w-5 h-5 text-slate-400" />
                                <h2 className="text-xl font-semibold text-foreground">Brand Accent Colors</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Primary Color (Hex)</label>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg border border-slate-700 shrink-0 shadow-inner" style={{ backgroundColor: primaryColor }} />
                                        <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} pattern="^#[0-9A-Fa-f]{6}$" className="w-full bg-slate-800 border-slate-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-nerve/50 uppercase" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Accent Color (Hex)</label>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg border border-slate-700 shrink-0 shadow-inner" style={{ backgroundColor: accentColor }} />
                                        <input type="text" value={accentColor} onChange={e => setAccentColor(e.target.value)} pattern="^#[0-9A-Fa-f]{6}$" className="w-full bg-slate-800 border-slate-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-nerve/50 uppercase" />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end">
                                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-nerve hover:brightness-110 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50">
                                    {isSaving ? 'Saving Changes...' : 'Save Configuration'}
                                </button>
                            </div>
                        </div>
                    </form>

                    <hr className="border-slate-800" />

                    <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />
                        <h2 className="text-xl font-bold text-destructive mb-2">Danger Zone</h2>
                        <p className="text-sm text-slate-400 max-w-2xl mb-6">
                            Deleting a workspace is an irreversible action. All assets, agent telemetry data, and member associations will be permanently destroyed.
                        </p>
                        <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="px-6 py-2.5 bg-destructive text-white text-sm font-medium rounded-lg hover:bg-destructive/90 transition-colors shadow-lg shadow-destructive/20">
                            Delete Workspace
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ API KEYS TAB ═══ */}
            {activeTab === 'api-keys' && (
                <div className="space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Key className="w-5 h-5 text-nerve" />
                                <h2 className="text-xl font-semibold text-foreground">API Keys</h2>
                            </div>
                            <button onClick={() => { setShowCreateKey(true); setNewlyCreatedKey(null); }} className="flex items-center gap-2 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110 transition text-sm font-medium">
                                <Plus size={16} /> Generate Key
                            </button>
                        </div>

                        <p className="text-sm text-slate-400 mb-6">
                            API keys allow external systems to access your workspace&apos;s data programmatically. Keys are hashed and cannot be recovered after creation.
                        </p>

                        {/* Newly Created Key Banner */}
                        {newlyCreatedKey && (
                            <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-2">
                                    <Shield size={16} />
                                    Your new API key — copy it now, it will not be shown again:
                                </div>
                                <div className="flex items-center gap-2 bg-slate-950 rounded-lg p-3">
                                    <code className="flex-1 text-sm text-green-300 font-mono break-all">{newlyCreatedKey}</code>
                                    <button onClick={() => copyToClipboard(newlyCreatedKey)} className="p-1.5 text-slate-400 hover:text-white transition rounded">
                                        {copiedKey ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Create Key Form */}
                        {showCreateKey && (
                            <form onSubmit={handleCreateKey} className="mb-6 bg-slate-950 rounded-lg p-5 border border-slate-800 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Key Name</label>
                                        <input required value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-nerve" placeholder="e.g., CI/CD Pipeline" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Expiration</label>
                                        <select value={newKeyExpiry} onChange={e => setNewKeyExpiry(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-nerve">
                                            <option value="never">Never</option>
                                            <option value="30d">30 Days</option>
                                            <option value="90d">90 Days</option>
                                            <option value="1y">1 Year</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Permission Scopes</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['read', 'write', 'admin', 'agents', 'scripts'].map(scope => (
                                            <button key={scope} type="button" onClick={() => toggleScope(scope)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${newKeyScopes.includes(scope) ? 'bg-nerve/10 border-nerve text-nerve' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                                {scope}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setShowCreateKey(false)} className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition">Cancel</button>
                                    <button type="submit" disabled={creatingKey || newKeyScopes.length === 0} className="px-5 py-2 bg-nerve text-white rounded-lg text-sm font-medium hover:brightness-110 disabled:opacity-50 transition">
                                        {creatingKey ? 'Generating...' : 'Generate Key'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Keys List */}
                        {loadingKeys ? (
                            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nerve" /></div>
                        ) : apiKeys.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No API keys configured. Generate one to enable programmatic access.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {apiKeys.map(key => (
                                    <div key={key.id} className={`flex items-center justify-between px-4 py-3 rounded-lg border transition ${key.revokedAt ? 'border-slate-800 bg-slate-900/30 opacity-60' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-foreground">{key.name}</span>
                                                {key.revokedAt && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">Revoked</span>}
                                                {key.expiresAt && new Date(key.expiresAt) < new Date() && !key.revokedAt && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">Expired</span>}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                <code className="font-mono">{key.prefix}•••••••</code>
                                                <span className="flex items-center gap-1"><Clock size={10} /> {new Date(key.createdAt).toLocaleDateString()}</span>
                                                <span>{key.usageCount} uses</span>
                                                {key.lastUsedAt && <span>Last: {new Date(key.lastUsedAt).toLocaleDateString()}</span>}
                                            </div>
                                            <div className="flex gap-1 mt-1.5">
                                                {key.scopes.map(s => <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">{s}</span>)}
                                            </div>
                                        </div>
                                        {!key.revokedAt && (
                                            <button onClick={() => requestRevokeKey(key.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition" title="Revoke Key">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ WEBHOOKS TAB ═══ */}
            {activeTab === 'webhooks' && (
                <div className="space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Webhook className="w-5 h-5 text-nerve" />
                                <h2 className="text-xl font-semibold text-foreground">Webhook Endpoints</h2>
                            </div>
                            <button onClick={() => setShowAddWebhook(true)} className="flex items-center gap-2 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110 transition text-sm font-medium">
                                <Plus size={16} /> Add Endpoint
                            </button>
                        </div>

                        <p className="text-sm text-slate-400 mb-6">
                            Webhook endpoints receive real-time HTTP POST notifications for alerts, automation actions, and script deployments. Payloads are signed with HMAC-SHA256.
                        </p>

                        {/* Add Webhook Form */}
                        {showAddWebhook && (
                            <form onSubmit={handleAddWebhook} className="mb-6 bg-slate-950 rounded-lg p-5 border border-slate-800 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Endpoint URL</label>
                                    <input type="url" required value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-nerve font-mono" placeholder="https://your-app.com/webhooks/glanus" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Secret (optional — for HMAC signature verification)</label>
                                    <input type="text" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-nerve font-mono" placeholder="whsec_..." />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setShowAddWebhook(false)} className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition">Cancel</button>
                                    <button type="submit" disabled={addingWebhook} className="px-5 py-2 bg-nerve text-white rounded-lg text-sm font-medium hover:brightness-110 disabled:opacity-50 transition">
                                        {addingWebhook ? 'Adding...' : 'Add Webhook'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Webhooks List */}
                        {loadingWebhooks ? (
                            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nerve" /></div>
                        ) : webhooks.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No webhook endpoints configured.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {webhooks.map(wh => (
                                    <div key={wh.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${wh.enabled ? 'bg-green-400' : 'bg-slate-500'}`} />
                                                <code className="font-mono text-sm text-foreground truncate">{wh.url}</code>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                <span>{wh.enabled ? 'Active' : 'Disabled'}</span>
                                                <span>{wh.secret ? '🔒 Signed' : '🔓 Unsigned'}</span>
                                                {wh.lastSuccess && <span className="text-green-400">Last OK: {new Date(wh.lastSuccess).toLocaleDateString()}</span>}
                                                {wh.failureCount > 0 && <span className="text-red-400">{wh.failureCount} failures</span>}
                                            </div>
                                        </div>
                                        <button onClick={() => requestDeleteWebhook(wh.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition" title="Remove">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ NOTIFICATIONS TAB ═══ */}
            {activeTab === 'notifications' && (
                <div className="space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <Bell className="w-5 h-5 text-nerve" />
                            <h2 className="text-xl font-semibold text-foreground">Notification Preferences</h2>
                        </div>

                        <p className="text-sm text-slate-400 mb-6">
                            Control how and when this workspace sends alert notifications. Preferences apply to all workspace members.
                        </p>

                        <div className="space-y-6">
                            {/* Email Notifications */}
                            <div className="flex items-center justify-between py-3 border-b border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <Bell size={16} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-foreground">Email Notifications</div>
                                        <div className="text-xs text-slate-500">Send alert notifications to workspace admin emails</div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setEmailNotifs(!emailNotifs)} className="text-nerve">
                                    {emailNotifs ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-slate-500" />}
                                </button>
                            </div>

                            {/* Webhook Notifications */}
                            <div className="flex items-center justify-between py-3 border-b border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                        <Webhook size={16} className="text-purple-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-foreground">Webhook Notifications</div>
                                        <div className="text-xs text-slate-500">Deliver alert payloads to configured webhook endpoints</div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setWebhookNotifs(!webhookNotifs)} className="text-nerve">
                                    {webhookNotifs ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-slate-500" />}
                                </button>
                            </div>

                            {/* Alert Severity Filter */}
                            <div className="py-3">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                        <AlertTriangle size={16} className="text-amber-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-foreground">Alert Severity Filter</div>
                                        <div className="text-xs text-slate-500">Only send notifications for alerts at or above this severity</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-12">
                                    {['all', 'INFO', 'WARNING', 'CRITICAL'].map(level => (
                                        <button key={level} type="button" onClick={() => setAlertSeverityFilter(level)} className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${alertSeverityFilter === level ? 'bg-nerve/10 border-nerve text-nerve' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                            {level === 'all' ? 'All Severities' : level}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button type="button" onClick={async () => {
                                try {
                                    const res = await csrfFetch(`/api/workspaces/${workspaceId}/notifications/preferences`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ emailNotifs, webhookNotifs, alertSeverityFilter }),
                                    });
                                    if (!res.ok) throw new Error('Failed to save');
                                    toastSuccess('Preferences Saved', 'Notification preferences updated.');
                                } catch {
                                    toastError('Save Failed', 'Could not save notification preferences.');
                                }
                            }} className="px-6 py-2.5 bg-nerve hover:brightness-110 text-white text-sm font-medium rounded-lg transition-all">
                                Save Preferences
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-destructive/20 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4 text-destructive">
                                <AlertTriangle className="w-6 h-6" />
                                <h2 className="text-xl font-bold">Delete Workspace?</h2>
                            </div>
                            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                                This action <span className="font-bold text-white">cannot be undone</span>. This will permanently delete the
                                <span className="font-bold text-white px-1">{workspace.name}</span> workspace, its members, assets, and all AI insight history.
                            </p>
                            <div className="bg-slate-950 rounded-lg p-4 mb-6 border border-slate-800">
                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                    Please type <span className="font-bold text-white select-all">{workspace.name}</span> to confirm.
                                </label>
                                <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} className="w-full bg-black border-slate-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-1 focus:ring-destructive focus:border-destructive font-mono text-sm" placeholder={workspace.name} />
                            </div>
                            <div className="flex items-center justify-end gap-3">
                                <button type="button" onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); }} className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
                                <button type="button" onClick={handleDelete} disabled={deleteConfirmText !== workspace.name || isDeleting} className="px-6 py-2.5 bg-destructive hover:bg-destructive/90 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isDeleting ? 'Deleting...' : 'I understand, delete workspace'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel="Confirm"
                variant="danger"
                onConfirm={() => {
                    confirmState.action?.();
                    setConfirmState({ open: false, action: null, title: '', message: '' });
                }}
                onCancel={() => setConfirmState({ open: false, action: null, title: '', message: '' })}
            />
        </div>
    );
}
