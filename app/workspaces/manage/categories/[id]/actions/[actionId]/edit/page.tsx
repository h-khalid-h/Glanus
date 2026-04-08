'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageSpinner } from '@/components/ui/Spinner';
import { ArrowLeft } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace/context';

export default function EditActionPage({ params }: { params: Promise<{ id: string; actionId: string }> }) {
    const router = useRouter();
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [actionId, setActionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { workspace } = useWorkspace();

    const [form, setForm] = useState({
        name: '',
        label: '',
        slug: '',
        description: '',
        handlerType: 'MANUAL',
        icon: '⚡',
        requiresConfirmation: false,
        confirmationMessage: '',
        isDestructive: false,
        sortOrder: 0,
    });

    useEffect(() => {
        const init = async () => {
            if (!workspace?.id) return;
            const resolvedParams = await params;
            setCategoryId(resolvedParams.id);
            setActionId(resolvedParams.actionId);
            await fetchAction(resolvedParams.id, resolvedParams.actionId, workspace.id);
        };
        init();
    }, [params, workspace?.id]);

    const fetchAction = async (catId: string, actId: string, wsId: string) => {
        try {
            const response = await csrfFetch(`/api/admin/asset-categories/${catId}/actions?workspaceId=${wsId}`);
            if (!response.ok) throw new Error('Failed to fetch actions');
            const json = await response.json();
            const actionsList = json.data?.actions || json.actions || json.data || json || [];
            const action = Array.isArray(actionsList) ? actionsList.find((a: { id: string }) => a.id === actId) : actionsList;
            if (!action) throw new Error('Action not found');
            setForm({
                name: action.name || '',
                label: action.label || '',
                slug: action.slug || '',
                description: action.description || '',
                handlerType: action.handlerType || action.actionType || 'MANUAL',
                icon: action.icon || '⚡',
                requiresConfirmation: action.requiresConfirmation || false,
                confirmationMessage: action.confirmationMessage || '',
                isDestructive: action.isDestructive || false,
                sortOrder: action.sortOrder || 0,
            });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!actionId) return;

        try {
            setSaving(true);
            setError(null);

            const payload = { ...form, workspaceId: workspace?.id };
            const response = await csrfFetch(`/api/admin/actions/${actionId}?workspaceId=${workspace?.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update action');
            }

            router.push(`/workspaces/manage/categories/${categoryId}/actions`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <PageSpinner text="Loading action..." />;
    }

    if (error) return <ErrorState title="Something went wrong" description={error} onRetry={() => window.location.reload()} />;

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="mb-5">
                <Link
                    href={`/workspaces/manage/categories/${categoryId}/actions`}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                    <ArrowLeft size={14} />
                    Actions
                </Link>
                <h1 className="text-xl font-semibold text-foreground">Edit Action</h1>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="detail-panel">
                    <h3 className="detail-panel-title">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Name *</label>
                            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Label *</label>
                            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input w-full" required />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-foreground mb-1.5">Slug *</label>
                        <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })} className="input w-full" required />
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input w-full resize-none" />
                    </div>
                </div>

                <div className="detail-panel">
                    <h3 className="detail-panel-title">Configuration</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Handler Type</label>
                            <select value={form.handlerType} onChange={(e) => setForm({ ...form, handlerType: e.target.value })} className="input w-full">
                                <option value="MANUAL">Manual</option>
                                <option value="API">API</option>
                                <option value="WEBHOOK">Webhook</option>
                                <option value="SCRIPT">Script</option>
                                <option value="REMOTE_COMMAND">Remote Command</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Icon</label>
                            <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="input w-full" />
                        </div>
                    </div>

                    <div className="mt-4 space-y-2.5">
                        <div className="flex items-center gap-2 p-2.5 bg-surface-1/50 border border-border rounded-lg">
                            <input type="checkbox" checked={form.requiresConfirmation} onChange={(e) => setForm({ ...form, requiresConfirmation: e.target.checked })} className="h-4 w-4 rounded border-border accent-primary" id="requiresConfirmation" />
                            <label htmlFor="requiresConfirmation" className="text-sm text-foreground">Requires confirmation</label>
                        </div>
                        {form.requiresConfirmation && (
                            <input value={form.confirmationMessage} onChange={(e) => setForm({ ...form, confirmationMessage: e.target.value })} className="input w-full" placeholder="Confirmation message..." />
                        )}
                        <div className="flex items-center gap-2 p-2.5 bg-surface-1/50 border border-border rounded-lg">
                            <input type="checkbox" checked={form.isDestructive} onChange={(e) => setForm({ ...form, isDestructive: e.target.checked })} className="h-4 w-4 rounded border-border accent-destructive" id="isDestructive" />
                            <label htmlFor="isDestructive" className="text-sm text-foreground">Destructive action</label>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                    <Link href={`/workspaces/manage/categories/${categoryId}/actions`} className="btn-secondary h-9 text-sm px-4">Cancel</Link>
                    <button type="submit" disabled={saving} className="btn-primary h-9 text-sm px-4 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {saving ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent" /> Saving…</> : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}
