'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace/context';

export default function NewActionPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
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
            const resolvedParams = await params;
            setCategoryId(resolvedParams.id);
        };
        init();
    }, [params]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryId) return;

        try {
            setLoading(true);
            setError(null);

            const payload = { ...form, workspaceId: workspace?.id };
            const response = await csrfFetch(`/api/admin/asset-categories/${categoryId}/actions?workspaceId=${workspace?.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create action');
            }

            router.push(`/admin/asset-categories/${categoryId}/actions`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };


    if (error) return <ErrorState title="Something went wrong" description={error} onRetry={() => window.location.reload()} />;

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="mb-5">
                <Link
                    href={`/admin/asset-categories/${categoryId}/actions`}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                    <ArrowLeft size={14} />
                    Actions
                </Link>
                <h1 className="text-xl font-semibold text-foreground">Create New Action</h1>
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
                            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" placeholder="e.g., Restart Device" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Label *</label>
                            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input w-full" placeholder="e.g., Restart" required />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-foreground mb-1.5">Slug *</label>
                        <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })} className="input w-full" placeholder="e.g., restart_device" required />
                        <p className="mt-1 text-xs text-muted-foreground">Lowercase with underscores/hyphens</p>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input w-full resize-none" placeholder="What does this action do?" />
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
                            <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="input w-full" placeholder="⚡" />
                        </div>
                    </div>

                    <div className="mt-4 space-y-2.5">
                        <div className="flex items-center gap-2 p-2.5 bg-surface-1/50 border border-border rounded-lg">
                            <input type="checkbox" checked={form.requiresConfirmation} onChange={(e) => setForm({ ...form, requiresConfirmation: e.target.checked })} className="h-4 w-4 rounded border-border accent-primary" id="requiresConfirmation" />
                            <label htmlFor="requiresConfirmation" className="text-sm text-foreground">Requires confirmation before executing</label>
                        </div>
                        {form.requiresConfirmation && (
                            <input value={form.confirmationMessage} onChange={(e) => setForm({ ...form, confirmationMessage: e.target.value })} className="input w-full" placeholder="Are you sure you want to..." />
                        )}
                        <div className="flex items-center gap-2 p-2.5 bg-surface-1/50 border border-border rounded-lg">
                            <input type="checkbox" checked={form.isDestructive} onChange={(e) => setForm({ ...form, isDestructive: e.target.checked })} className="h-4 w-4 rounded border-border accent-destructive" id="isDestructive" />
                            <label htmlFor="isDestructive" className="text-sm text-foreground">Destructive action (shown with warning styling)</label>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                    <Link href={`/admin/asset-categories/${categoryId}/actions`} className="btn-secondary h-9 text-sm px-4">Cancel</Link>
                    <button type="submit" disabled={loading} className="btn-primary h-9 text-sm px-4 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent" /> Creating…</> : 'Create Action'}
                    </button>
                </div>
            </form>
        </div>
    );
}
