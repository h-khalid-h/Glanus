'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageSpinner } from '@/components/ui/Spinner';
import { ArrowLeft } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace/context';

export default function EditFieldPage({ params }: { params: Promise<{ id: string; fieldId: string }> }) {
    const router = useRouter();
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [fieldId, setFieldId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { workspace } = useWorkspace();

    const [form, setForm] = useState({
        name: '',
        label: '',
        slug: '',
        description: '',
        type: 'STRING',
        isRequired: false,
        isInherited: false,
        defaultValue: '',
        sortOrder: 0,
        isActive: true,
    });

    useEffect(() => {
        const init = async () => {
            if (!workspace?.id) return;
            const resolvedParams = await params;
            setCategoryId(resolvedParams.id);
            setFieldId(resolvedParams.fieldId);
            await fetchField(resolvedParams.id, resolvedParams.fieldId, workspace.id);
        };
        init();
    }, [params, workspace?.id]);

    const fetchField = async (catId: string, fldId: string, wsId: string) => {
        try {
            const response = await csrfFetch(`/api/admin/asset-categories/${catId}/fields?workspaceId=${wsId}`);
            if (!response.ok) throw new Error('Failed to fetch fields');
            const json = await response.json();
            const fieldsList = json.data?.fields || json.fields || json.data || json;
            const field = Array.isArray(fieldsList) ? fieldsList.find((f: { id: string }) => f.id === fldId) : fieldsList;
            if (!field) throw new Error('Field not found');
            setForm({
                name: field.name || '',
                label: field.label || '',
                slug: field.slug || '',
                description: field.description || '',
                type: field.type || 'STRING',
                isRequired: field.isRequired || false,
                isInherited: field.isInherited || false,
                defaultValue: field.defaultValue || '',
                sortOrder: field.sortOrder || 0,
                isActive: field.isActive ?? true,
            });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fieldId) return;

        try {
            setSaving(true);
            setError(null);

            const payload = { ...form, workspaceId: workspace?.id };
            const response = await csrfFetch(`/api/admin/fields/${fieldId}?workspaceId=${workspace?.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update field');
            }

            router.push(`/workspaces/manage/categories/${categoryId}/fields`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <PageSpinner text="Loading field..." />;
    }

    if (error) return <ErrorState title="Something went wrong" description={error} onRetry={() => window.location.reload()} />;

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="mb-5">
                <Link
                    href={`/workspaces/manage/categories/${categoryId}/fields`}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                    <ArrowLeft size={14} />
                    Fields
                </Link>
                <h1 className="text-xl font-semibold text-foreground">Edit Field</h1>
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
                            <input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="input w-full"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Label *</label>
                            <input
                                value={form.label}
                                onChange={(e) => setForm({ ...form, label: e.target.value })}
                                className="input w-full"
                                required
                            />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-foreground mb-1.5">Slug *</label>
                        <input
                            value={form.slug}
                            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })}
                            className="input w-full"
                            required
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Lowercase with underscores only</p>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            rows={2}
                            className="input w-full resize-none"
                        />
                    </div>
                </div>

                <div className="detail-panel">
                    <h3 className="detail-panel-title">Field Configuration</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Field Type</label>
                            <select
                                value={form.type}
                                onChange={(e) => setForm({ ...form, type: e.target.value })}
                                className="input w-full"
                                aria-label="Field Type"
                            >
                                <option value="STRING">String</option>
                                <option value="NUMBER">Number</option>
                                <option value="DATE">Date</option>
                                <option value="BOOLEAN">Boolean</option>
                                <option value="JSON">JSON</option>
                                <option value="ENUM">Enum</option>
                                <option value="TEXT">Text (Long)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Sort Order</label>
                            <input
                                type="number"
                                value={form.sortOrder}
                                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                                className="input w-full"
                                min="0"
                            />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-foreground mb-1.5">Default Value</label>
                        <input
                            value={form.defaultValue}
                            onChange={(e) => setForm({ ...form, defaultValue: e.target.value })}
                            className="input w-full"
                            placeholder="Default value..."
                        />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                        {([
                            { key: 'isRequired', label: 'Required' },
                            { key: 'isInherited', label: 'Inherited by subcategories' },
                            { key: 'isActive', label: 'Active' },
                        ] as const).map(({ key, label }) => (
                            <div key={key} className="flex items-center gap-2 p-2.5 bg-surface-1/50 border border-border rounded-lg">
                                <input
                                    type="checkbox"
                                    checked={form[key]}
                                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                                    className="h-4 w-4 rounded border-border accent-primary"
                                    id={key}
                                />
                                <label htmlFor={key} className="text-sm text-foreground">{label}</label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                    <Link href={`/workspaces/manage/categories/${categoryId}/fields`} className="btn-secondary h-9 text-sm px-4">Cancel</Link>
                    <button type="submit" disabled={saving} className="btn-primary h-9 text-sm px-4 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {saving ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent" /> Saving…</> : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}
