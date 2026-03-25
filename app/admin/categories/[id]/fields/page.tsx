'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import { AssetFieldDefinition } from '@prisma/client';
import { ArrowLeft } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';

export default function FieldsPage({ params }: { params: Promise<{ id: string }> }) {
    const { error: showError } = useToast();
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [categoryName, setCategoryName] = useState<string>('');
    const [fields, setFields] = useState<AssetFieldDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmFieldId, setConfirmFieldId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const resolvedParams = await params;
            setCategoryId(resolvedParams.id);
            fetchFields(resolvedParams.id);
            fetchCategory(resolvedParams.id);
        };
        init();
    }, [params]);

    const fetchCategory = async (id: string) => {
        try {
            const response = await csrfFetch(`/api/admin/categories/${id}`);
            if (!response.ok) throw new Error('Failed to fetch category');
            const data = await response.json();
            setCategoryName(data.name);
        } catch (err: unknown) {
            showError('Error fetching category:', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    const fetchFields = async (id: string) => {
        try {
            setLoading(true);
            const response = await csrfFetch(`/api/admin/categories/${id}/fields`);
            if (!response.ok) throw new Error('Failed to fetch fields');
            const data = await response.json();
            const fieldsList = data.fields || [];
            setFields(fieldsList.sort((a: AssetFieldDefinition, b: AssetFieldDefinition) => a.sortOrder - b.sortOrder));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const requestDeleteField = (fieldId: string) => {
        setConfirmFieldId(fieldId);
    };

    const deleteField = async () => {
        const fieldId = confirmFieldId;
        setConfirmFieldId(null);
        if (!fieldId) return;

        try {
            const response = await csrfFetch(`/api/admin/categories/${categoryId}/fields/${fieldId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete field');

            // Refresh list
            if (categoryId) fetchFields(categoryId);
        } catch (err: unknown) {
            showError('Action failed', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    if (loading) {
        return <PageSpinner text="Loading fields..." />;
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <p className="text-health-critical">Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <ConfirmDialog
                open={!!confirmFieldId}
                title="Delete Field"
                message="Are you sure you want to delete this field? Existing asset data for this field will be lost."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={deleteField}
                onCancel={() => setConfirmFieldId(null)}
            />
            <div className="mb-6">
                <Link
                    href="/admin/categories"
                    className="inline-flex items-center gap-2 text-nerve hover:text-nerve mb-4"
                >
                    <ArrowLeft size={20} />
                    Back to Categories
                </Link>
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Field Definitions</h1>
                        <p className="text-slate-400 mt-1">Category: {categoryName}</p>
                    </div>
                    <Link
                        href={`/admin/categories/${categoryId}/fields/new`}
                        className="flex items-center gap-2 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110 transition-colors"
                    >
                        <Plus size={20} />
                        New Field
                    </Link>
                </div>
            </div>

            {fields.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/30 rounded-lg">
                    <p className="text-lg text-slate-400 mb-4">No fields defined yet</p>
                    <Link
                        href={`/admin/categories/${categoryId}/fields/new`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110"
                    >
                        <Plus size={20} />
                        Create First Field
                    </Link>
                </div>
            ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                        <thead className="bg-slate-900/30 border-b border-slate-800">
                            <tr>
                                <th className="w-12 px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Order
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Field
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Slug
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Flags
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {fields.map((field) => (
                                <tr key={field.id} className="hover:bg-slate-900/30">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <GripVertical size={16} />
                                            <span className="text-sm">{field.sortOrder}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div>
                                            <div className="text-sm font-medium text-foreground">{field.label}</div>
                                            <div className="text-sm text-slate-500">{field.name}</div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                                            {field.fieldType}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <code className="text-sm text-slate-400">{field.slug}</code>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex gap-1">
                                            {field.isRequired && (
                                                <span className="px-2 py-1 text-xs font-medium bg-health-critical/15 text-health-critical rounded">
                                                    Required
                                                </span>
                                            )}
                                            {field.isUnique && (
                                                <span className="px-2 py-1 text-xs font-medium bg-nerve/10 text-nerve rounded">
                                                    Unique
                                                </span>
                                            )}
                                            {!field.isVisible && (
                                                <span className="px-2 py-1 text-xs font-medium bg-slate-800/50 text-slate-200 rounded">
                                                    Hidden
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                href={`/admin/categories/${categoryId}/fields/${field.id}/edit`}
                                                className="p-2 text-slate-400 hover:bg-slate-800/50 rounded transition-colors"
                                                aria-label={`Edit ${field.label}`}
                                            >
                                                <Edit2 size={16} />
                                            </Link>
                                            <button type="button"
                                                onClick={() => requestDeleteField(field.id)}
                                                className="p-2 text-health-critical hover:bg-health-critical/10 rounded transition-colors"
                                                aria-label={`Delete ${field.label}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
