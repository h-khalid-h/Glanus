'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import {
    Settings, ShieldAlert, AlertTriangle, Building2, Paintbrush,
    Key, Webhook, Bell, Plus, Trash2, Copy, Check,
    Shield, Clock, Globe, ToggleLeft, ToggleRight, CreditCard
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';
import { BillingTab } from './components/BillingTab';
import { Suspense } from 'react';

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

type SettingsTab = 'general' | 'api-keys' | 'webhooks' | 'notifications' | 'billing';

export default function WorkspaceSettingsPage() {
    const router = useRouter();
    const workspaceId = useWorkspaceId();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    useEffect(() => {
        if (activeTab === 'api-keys') fetchApiKeys();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (activeTab === 'webhooks') fetchWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            if (!res.ok) throw new Error('Failed to fetch API keys');
            const data = await res.json();
            setApiKeys(data.data?.keys || []);
        } catch {
            toastError('Load Error', 'Failed to fetch API keys');
        } finally {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            setLoadingKeys(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            if (!res.ok) throw new Error('Failed to fetch webhooks');
            const data = await res.json();
            setWebhooks(Array.isArray(data.data?.webhooks) ? data.data.webhooks : data.data ? [data.data] : []);
        } catch {
            toastError('Load Error', 'Failed to fetch webhooks');
        // eslint-disable-next-line react-hooks/exhaustive-deps
        } finally {
            setLoadingWebhooks(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <div className="max-w-4xl  space-y-6">
                <div className="h-8 w-64 animate-pulse rounded-xl bg-surface-2" />
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
                <p className="text-muted-foreground">You must be the Workspace Owner to view this page.</p>
            </div>
        );
    }

    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        { id: 'general', label: 'General', icon: <Building2 size={16} /> },
        { id: 'billing', label: 'Billing', icon: <CreditCard size={16} /> },
        { id: 'api-keys', label: 'API Keys', icon: <Key size={16} /> },
        { id: 'webhooks', label: 'Webhooks', icon: <Webhook size={16} /> },
        { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    ];

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Workspace Settings</h1>
                        <p className="text-muted-foreground">Manage workspace configuration, security, and integrations</p>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-8 bg-card rounded-xl p-1 border border-border">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                            ? 'bg-primary text-foreground shadow-lg shadow-primary/20'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
                        <div className="bg-card border border-border rounded-xl p-6 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-6">
                                <Building2 className="w-5 h-5 text-muted-foreground" />
                                <h2 className="text-xl font-semibold text-foreground">General Information</h2>
                            </div>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Workspace Name</label>
                                    <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-muted border-border text-foreground rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-muted border-border text-foreground rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/50 resize-y" placeholder="A brief description of this organization..." />
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-xl p-6 backdrop-blur-sm overflow-hidden relative">
                            {/* Decorative background element showing the primary color */}
                            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none" style={{ backgroundColor: primaryColor }} />
                            
                            <div className="flex items-center gap-2 mb-6 relative">
                                <Paintbrush className="w-5 h-5 text-muted-foreground" />
                                <h2 className="text-xl font-semibold text-foreground">Brand Profile</h2>
                            </div>

                            <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
                                Customize the platform's visual identity to match your company's branding. 
                                Changes will be instantly applied across the sidebar, buttons, and active interactive elements for all workspace members.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                                
                                {/* Color Controls */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-3">Primary Theme Color</label>
                                        <div className="flex flex-wrap gap-3 mb-4">
                                            {/* Predefined beautiful colors */}
                                            {[
                                                { hex: '#00E5C8', name: 'Glanus Teal' },
                                                { hex: '#3B82F6', name: 'Nexus Blue' },
                                                { hex: '#8B5CF6', name: 'Midnight Purple' },
                                                { hex: '#F43F5E', name: 'Crimson' },
                                                { hex: '#F59E0B', name: 'Warm Amber' },
                                                { hex: '#10B981', name: 'Emerald' }
                                            ].map(preset => (
                                                <button
                                                    key={preset.hex}
                                                    type="button"
                                                    onClick={() => setPrimaryColor(preset.hex)}
                                                    className={`w-8 h-8 rounded-full shadow-inner border-2 transition-all hover:scale-110 ${primaryColor.toUpperCase() === preset.hex ? 'border-white scale-110 ring-2 ring-border ring-offset-2 ring-offset-background' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                                    style={{ backgroundColor: preset.hex }}
                                                    title={preset.name}
                                                />
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="color" 
                                                value={primaryColor} 
                                                onChange={e => setPrimaryColor(e.target.value)}
                                                className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                                            />
                                            <input 
                                                type="text" 
                                                value={primaryColor} 
                                                onChange={e => setPrimaryColor(e.target.value)} 
                                                pattern="^#[0-9A-Fa-f]{6}$" 
                                                className="w-40 bg-muted border-border text-foreground rounded-xl px-4 py-2 outline-none focus:ring-2 uppercase" 
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-3">Accent / Highlight Color</label>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="color" 
                                                value={accentColor} 
                                                onChange={e => setAccentColor(e.target.value)}
                                                className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                                            />
                                            <input 
                                                type="text" 
                                                value={accentColor} 
                                                onChange={e => setAccentColor(e.target.value)} 
                                                pattern="^#[0-9A-Fa-f]{6}$" 
                                                className="w-40 bg-muted border-border text-foreground rounded-xl px-4 py-2 outline-none focus:ring-2 uppercase" 
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">Used for hover states and subtle backgrounds.</p>
                                    </div>
                                </div>

                                {/* Live Preview Box */}
                                <div className="bg-background/80 border border-border rounded-xl p-5 flex flex-col justify-center gap-4">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Live Preview</div>
                                    
                                    <div className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
                                        <span className="text-sm font-medium text-foreground">System Component</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>Active (Accent)</span>
                                    </div>

                                    <div className="flex gap-2">
                                        <button type="button" className="px-4 py-1.5 rounded-md text-sm font-medium text-foreground shadow-lg transition-transform hover:-translate-y-0.5" style={{ backgroundColor: primaryColor, boxShadow: `0 4px 14px -4px ${primaryColor}a0` }}>
                                            Primary Action
                                        </button>
                                        <button type="button" className="px-4 py-1.5 rounded-md text-sm font-medium border transition-colors" style={{ borderColor: primaryColor, color: primaryColor, backgroundColor: 'transparent' }}>
                                            Secondary
                                        </button>
                                    </div>

                                    <div className="w-full h-1 mt-2 rounded-full overflow-hidden bg-muted">
                                        <div className="h-full rounded-full" style={{ width: '65%', backgroundColor: accentColor }} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-8 flex justify-end pt-5 border-t border-border/60">
                                <button type="submit" disabled={isSaving} className="px-6 py-2.5 text-foreground text-sm font-medium rounded-xl transition-all disabled:opacity-50 shadow-lg hover:brightness-110" style={{ backgroundColor: primaryColor, boxShadow: `0 4px 14px -4px ${primaryColor}a0` }}>
                                    {isSaving ? 'Applying Theme...' : 'Apply Theme'}
                                </button>
                            </div>
                        </div>
                    </form>

                    <hr className="border-border" />

                    <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />
                        <h2 className="text-xl font-bold text-destructive mb-2">Danger Zone</h2>
                        <p className="text-sm text-muted-foreground max-w-2xl mb-6">
                            Deleting a workspace is an irreversible action. All assets, agent telemetry data, and member associations will be permanently destroyed.
                        </p>
                        <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="px-6 py-2.5 bg-destructive text-foreground text-sm font-medium rounded-xl hover:bg-destructive/90 transition-colors shadow-lg shadow-destructive/20">
                            Delete Workspace
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ BILLING TAB ═══ */}
            {activeTab === 'billing' && (
                <Suspense fallback={
                    <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                }>
                    <BillingTab />
                </Suspense>
            )}

            {/* ═══ API KEYS TAB ═══ */}
            {activeTab === 'api-keys' && (
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Key className="w-5 h-5 text-primary" />
                                <h2 className="text-xl font-semibold text-foreground">API Keys</h2>
                            </div>
                            <button onClick={() => { setShowCreateKey(true); setNewlyCreatedKey(null); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-foreground rounded-xl hover:brightness-110 transition text-sm font-medium">
                                <Plus size={16} /> Generate Key
                            </button>
                        </div>

                        <p className="text-sm text-muted-foreground mb-6">
                            API keys allow external systems to access your workspace&apos;s data programmatically. Keys are hashed and cannot be recovered after creation.
                        </p>

                        {/* Newly Created Key Banner */}
                        {newlyCreatedKey && (
                            <div className="mb-6 bg-success/10 border border-success/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-success text-sm font-medium mb-2">
                                    <Shield size={16} />
                                    Your new API key — copy it now, it will not be shown again:
                                </div>
                                <div className="flex items-center gap-2 bg-background rounded-xl p-3">
                                    <code className="flex-1 text-sm text-success font-mono break-all">{newlyCreatedKey}</code>
                                    <button onClick={() => copyToClipboard(newlyCreatedKey)} className="p-1.5 text-muted-foreground hover:text-foreground transition rounded">
                                        {copiedKey ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Create Key Form */}
                        {showCreateKey && (
                            <form onSubmit={handleCreateKey} className="mb-6 bg-background rounded-xl p-5 border border-border space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Key Name</label>
                                        <input required value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary" placeholder="e.g., CI/CD Pipeline" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Expiration</label>
                                        <select value={newKeyExpiry} onChange={e => setNewKeyExpiry(e.target.value)} className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary">
                                            <option value="never">Never</option>
                                            <option value="30d">30 Days</option>
                                            <option value="90d">90 Days</option>
                                            <option value="1y">1 Year</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">Permission Scopes</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['read', 'write', 'admin', 'agents', 'scripts'].map(scope => (
                                            <button key={scope} type="button" onClick={() => toggleScope(scope)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${newKeyScopes.includes(scope) ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}>
                                                {scope}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setShowCreateKey(false)} className="px-4 py-2 text-sm text-foreground hover:bg-muted rounded-xl transition">Cancel</button>
                                    <button type="submit" disabled={creatingKey || newKeyScopes.length === 0} className="px-5 py-2 bg-primary text-foreground rounded-xl text-sm font-medium hover:brightness-110 disabled:opacity-50 transition">
                                        {creatingKey ? 'Generating...' : 'Generate Key'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Keys List */}
                        {loadingKeys ? (
                            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                        ) : apiKeys.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No API keys configured. Generate one to enable programmatic access.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {apiKeys.map(key => (
                                    <div key={key.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition ${key.revokedAt ? 'border-border bg-muted/30 opacity-60' : 'border-border bg-card hover:border-border'}`}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-foreground">{key.name}</span>
                                                {key.revokedAt && <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Revoked</span>}
                                                {key.expiresAt && new Date(key.expiresAt) < new Date() && !key.revokedAt && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-warning">Expired</span>}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                <code className="font-mono">{key.prefix}•••••••</code>
                                                <span className="flex items-center gap-1"><Clock size={10} /> {new Date(key.createdAt).toLocaleDateString()}</span>
                                                <span>{key.usageCount} uses</span>
                                                {key.lastUsedAt && <span>Last: {new Date(key.lastUsedAt).toLocaleDateString()}</span>}
                                            </div>
                                            <div className="flex gap-1 mt-1.5">
                                                {key.scopes.map(s => <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground uppercase">{s}</span>)}
                                            </div>
                                        </div>
                                        {!key.revokedAt && (
                                            <button onClick={() => requestRevokeKey(key.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition" title="Revoke Key" aria-label="Revoke API key">
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
                    <div className="bg-card border border-border rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Webhook className="w-5 h-5 text-primary" />
                                <h2 className="text-xl font-semibold text-foreground">Webhook Endpoints</h2>
                            </div>
                            <button onClick={() => setShowAddWebhook(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-foreground rounded-xl hover:brightness-110 transition text-sm font-medium">
                                <Plus size={16} /> Add Endpoint
                            </button>
                        </div>

                        <p className="text-sm text-muted-foreground mb-6">
                            Webhook endpoints receive real-time HTTP POST notifications for alerts, automation actions, and script deployments. Payloads are signed with HMAC-SHA256.
                        </p>

                        {/* Add Webhook Form */}
                        {showAddWebhook && (
                            <form onSubmit={handleAddWebhook} className="mb-6 bg-background rounded-xl p-5 border border-border space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Endpoint URL</label>
                                    <input type="url" required value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary font-mono" placeholder="https://your-app.com/webhooks/glanus" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Secret (optional — for HMAC signature verification)</label>
                                    <input type="text" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary font-mono" placeholder="whsec_..." />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setShowAddWebhook(false)} className="px-4 py-2 text-sm text-foreground hover:bg-muted rounded-xl transition">Cancel</button>
                                    <button type="submit" disabled={addingWebhook} className="px-5 py-2 bg-primary text-foreground rounded-xl text-sm font-medium hover:brightness-110 disabled:opacity-50 transition">
                                        {addingWebhook ? 'Adding...' : 'Add Webhook'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Webhooks List */}
                        {loadingWebhooks ? (
                            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                        ) : webhooks.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No webhook endpoints configured.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {webhooks.map(wh => (
                                    <div key={wh.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:border-border transition">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${wh.enabled ? 'bg-success' : 'bg-muted'}`} />
                                                <code className="font-mono text-sm text-foreground truncate">{wh.url}</code>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                <span>{wh.enabled ? 'Active' : 'Disabled'}</span>
                                                <span>{wh.secret ? '🔒 Signed' : '🔓 Unsigned'}</span>
                                                {wh.lastSuccess && <span className="text-success">Last OK: {new Date(wh.lastSuccess).toLocaleDateString()}</span>}
                                                {wh.failureCount > 0 && <span className="text-destructive">{wh.failureCount} failures</span>}
                                            </div>
                                        </div>
                                        <button onClick={() => requestDeleteWebhook(wh.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition" title="Remove">
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
                    <div className="bg-card border border-border rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <Bell className="w-5 h-5 text-primary" />
                            <h2 className="text-xl font-semibold text-foreground">Notification Preferences</h2>
                        </div>

                        <p className="text-sm text-muted-foreground mb-6">
                            Control how and when this workspace sends alert notifications. Preferences apply to all workspace members.
                        </p>

                        <div className="space-y-6">
                            {/* Email Notifications */}
                            <div className="flex items-center justify-between py-3 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-cortex/10 flex items-center justify-center">
                                        <Bell size={16} className="text-cortex" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-foreground">Email Notifications</div>
                                        <div className="text-xs text-muted-foreground">Send alert notifications to workspace admin emails</div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setEmailNotifs(!emailNotifs)} className="text-primary">
                                    {emailNotifs ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-muted-foreground" />}
                                </button>
                            </div>

                            {/* Webhook Notifications */}
                            <div className="flex items-center justify-between py-3 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                        <Webhook size={16} className="text-purple-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-foreground">Webhook Notifications</div>
                                        <div className="text-xs text-muted-foreground">Deliver alert payloads to configured webhook endpoints</div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setWebhookNotifs(!webhookNotifs)} className="text-primary">
                                    {webhookNotifs ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-muted-foreground" />}
                                </button>
                            </div>

                            {/* Alert Severity Filter */}
                            <div className="py-3">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                        <AlertTriangle size={16} className="text-warning" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-foreground">Alert Severity Filter</div>
                                        <div className="text-xs text-muted-foreground">Only send notifications for alerts at or above this severity</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-12">
                                    {['all', 'INFO', 'WARNING', 'CRITICAL'].map(level => (
                                        <button key={level} type="button" onClick={() => setAlertSeverityFilter(level)} className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${alertSeverityFilter === level ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}>
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
                            }} className="px-6 py-2.5 bg-primary hover:brightness-110 text-foreground text-sm font-medium rounded-xl transition-all">
                                Save Preferences
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface-1 border border-destructive/20 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4 text-destructive">
                                <AlertTriangle className="w-6 h-6" />
                                <h2 className="text-xl font-bold">Delete Workspace?</h2>
                            </div>
                            <p className="text-sm text-foreground mb-6 leading-relaxed">
                                This action <span className="font-bold text-foreground">cannot be undone</span>. This will permanently delete the
                                <span className="font-bold text-foreground px-1">{workspace.name}</span> workspace, its members, assets, and all AI insight history.
                            </p>
                            <div className="bg-background rounded-xl p-4 mb-6 border border-border">
                                <label className="block text-sm font-medium text-muted-foreground mb-2">
                                    Please type <span className="font-bold text-foreground select-all">{workspace.name}</span> to confirm.
                                </label>
                                <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} className="w-full bg-black border-border text-foreground rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-destructive focus:border-destructive font-mono text-sm" placeholder={workspace.name} />
                            </div>
                            <div className="flex items-center justify-end gap-3">
                                <button type="button" onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); }} className="px-4 py-2.5 text-sm font-medium text-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">Cancel</button>
                                <button type="button" onClick={handleDelete} disabled={deleteConfirmText !== workspace.name || isDeleting} className="px-6 py-2.5 bg-destructive hover:bg-destructive/90 text-foreground text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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
