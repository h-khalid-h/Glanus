'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';

import { useWorkspace } from '@/lib/workspace/context';
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
    const { workspace } = useWorkspace();
    const [confirmFieldId, setConfirmFieldId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            if (!workspace?.id) return;
            const resolvedParams = await params;
            setCategoryId(resolvedParams.id);
            fetchFields(resolvedParams.id, workspace.id);
            fetchCategory(resolvedParams.id, workspace.id);
        };
        init();
    }, [params, workspace?.id]);

    const fetchCategory = async (id: string, wsId: string) => {
        try {
            const response = await csrfFetch(`/api/admin/asset-categories/${id}?workspaceId=${wsId}`);
            if (!response.ok) throw new Error('Failed to fetch category');
            const json = await response.json();
            const data = json.data || json; // fallback
            setCategoryName(data.name);
        } catch (err: unknown) {
            showError('Error fetching category:', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    const fetchFields = async (id: string, wsId: string) => {
        try {
            setLoading(true);
            const response = await csrfFetch(`/api/admin/asset-categories/${id}/fields?workspaceId=${wsId}`);
            if (!response.ok) throw new Error('Failed to fetch fields');
            const json = await response.json();
            const fieldsList = json.data?.fields || json.fields || [];
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
            const response = await csrfFetch(`/api/admin/fields/${fieldId}?workspaceId=${workspace?.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete field');

            // Refresh list
            if (categoryId && workspace?.id) fetchFields(categoryId, workspace.id);
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
        <div className="max-w-4xl mx-auto animate-fade-in">
            <ConfirmDialog
                open={!!confirmFieldId}
                title="Delete Field"
                message="Are you sure you want to delete this field? Existing asset data for this field will be lost."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={deleteField}
                onCancel={() => setConfirmFieldId(null)}
            />
            <div className="mb-5">
                <Link
                    href="/workspaces/manage/categories"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                    <ArrowLeft size={14} />
                    Categories
                </Link>
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">Field Definitions</h1>
                        {categoryName && <p className="text-sm text-muted-foreground mt-0.5">{categoryName}</p>}
                    </div>
                    <Link
                        href={`/workspaces/manage/categories/${categoryId}/fields/new`}
                        className="btn-primary h-9 text-sm px-3 inline-flex items-center gap-1.5"
                    >
                        <Plus size={14} />
                        New Field
                    </Link>
                </div>
            </div>

            {fields.length === 0 ? (
                <div className="detail-panel text-center py-16">
                    <div className="h-10 w-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center mx-auto mb-3">
                        <Plus size={16} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">No fields defined yet</p>
                    <p className="text-xs text-muted-foreground mb-4">Add the first field to this category.</p>
                    <Link
                        href={`/workspaces/manage/categories/${categoryId}/fields/new`}
                        className="btn-primary h-8 text-xs px-3 inline-flex items-center gap-1.5"
                    >
                        <Plus size={12} /> Create First Field
                    </Link>
                </div>
            ) : (
                <div className="detail-panel p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                            <thead className="border-b border-border bg-surface-1/60">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">Order</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Field</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Slug</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flags</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {fields.map((field) => (
                                    <tr key={field.id} className="hover:bg-surface-1/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <GripVertical size={14} />
                                                <span className="text-xs">{field.sortOrder}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-medium text-foreground">{field.label}</p>
                                            <p className="text-xs text-muted-foreground/70 mt-0.5">{field.name}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 text-xs font-medium bg-cortex/10 text-cortex rounded border border-cortex/20">
                                                {field.fieldType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <code className="text-xs text-muted-foreground font-mono bg-surface-2 px-1.5 py-0.5 rounded">{field.slug}</code>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1 flex-wrap">
                                                {field.isRequired && (
                                                    <span className="px-1.5 py-0.5 text-xs font-medium bg-destructive/10 text-destructive rounded">Required</span>
                                                )}
                                                {field.isUnique && (
                                                    <span className="px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">Unique</span>
                                                )}
                                                {!field.isVisible && (
                                                    <span className="px-1.5 py-0.5 text-xs font-medium bg-muted/50 text-muted-foreground rounded">Hidden</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Link
                                                    href={`/workspaces/manage/categories/${categoryId}/fields/${field.id}/edit`}
                                                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded transition-colors"
                                                    aria-label={`Edit ${field.label}`}
                                                ><Edit2 size={14} /></Link>
                                                <button type="button"
                                                    onClick={() => requestDeleteField(field.id)}
                                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                                    aria-label={`Delete ${field.label}`}
                                                ><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
