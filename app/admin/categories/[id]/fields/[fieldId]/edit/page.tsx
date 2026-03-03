'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageSpinner } from '@/components/ui/Spinner';
import { ArrowLeft } from 'lucide-react';

export default function EditFieldPage({ params }: { params: Promise<{ id: string; fieldId: string }> }) {
    const router = useRouter();
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [fieldId, setFieldId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            const resolvedParams = await params;
            setCategoryId(resolvedParams.id);
            setFieldId(resolvedParams.fieldId);
            await fetchField(resolvedParams.id, resolvedParams.fieldId);
        };
        init();
    }, [params]);

    const fetchField = async (catId: string, fldId: string) => {
        try {
            const response = await csrfFetch(`/api/admin/categories/${catId}/fields`);
            if (!response.ok) throw new Error('Failed to fetch fields');
            const fields = await response.json();
            const field = fields.find((f: { id: string }) => f.id === fldId);
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

            const response = await csrfFetch(`/api/admin/fields/${fieldId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update field');
            }

            router.push(`/admin/categories/${categoryId}/fields`);
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
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <div className="mb-6">
                <Link
                    href={`/admin/categories/${categoryId}/fields`}
                    className="inline-flex items-center gap-2 text-nerve hover:text-nerve mb-4"
                >
                    <ArrowLeft size={20} />
                    Back to Fields
                </Link>
                <h1 className="text-3xl font-bold text-white">Edit Field</h1>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-health-critical/10 border border-health-critical/20 rounded-lg">
                    <p className="text-sm text-health-critical">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                <div className="space-y-6">
                    <div className="pb-6 border-b border-slate-800">
                        <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Name *</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Label *</label>
                                <input
                                    value={form.label}
                                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Slug *</label>
                            <input
                                value={form.slug}
                                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })}
                                className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                required
                            />
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={2}
                                className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                            />
                        </div>
                    </div>

                    <div className="pb-6 border-b border-slate-800">
                        <h3 className="text-lg font-semibold text-white mb-4">Field Configuration</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Field Type</label>
                                <select
                                    value={form.type}
                                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50"
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
                                <label className="block text-sm font-medium text-slate-300 mb-2">Sort Order</label>
                                <input
                                    type="number"
                                    value={form.sortOrder}
                                    onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    min="0"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Default Value</label>
                            <input
                                value={form.defaultValue}
                                onChange={(e) => setForm({ ...form, defaultValue: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                placeholder="Default value..."
                            />
                        </div>

                        <div className="mt-4 space-y-3">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={form.isRequired}
                                    onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
                                    className="h-4 w-4 text-nerve border-slate-700 rounded"
                                    id="isRequired"
                                />
                                <label htmlFor="isRequired" className="ml-2 text-sm text-slate-300">Required</label>
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={form.isInherited}
                                    onChange={(e) => setForm({ ...form, isInherited: e.target.checked })}
                                    className="h-4 w-4 text-nerve border-slate-700 rounded"
                                    id="isInherited"
                                />
                                <label htmlFor="isInherited" className="ml-2 text-sm text-slate-300">Inherited by subcategories</label>
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                    className="h-4 w-4 text-nerve border-slate-700 rounded"
                                    id="isActive"
                                />
                                <label htmlFor="isActive" className="ml-2 text-sm text-slate-300">Active</label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8 pt-6 border-t border-slate-800">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <Link
                        href={`/admin/categories/${categoryId}/fields`}
                        className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-900/30 transition-colors text-center"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    );
}
