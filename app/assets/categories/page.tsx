'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { AssetCategory } from '@prisma/client';
import { PageSpinner } from '@/components/ui/Spinner';
import { NoData, ErrorState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui';
import { useToast } from '@/lib/toast';
import { useWorkspace } from '@/lib/workspace/context';

export default function CategoriesPage() {
    const { workspace } = useWorkspace();
    const [categories, setCategories] = useState<AssetCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { success, error: showError } = useToast();
    const [confirmState, setConfirmState] = useState<{ open: boolean; id: string; name: string } | null>(null);

    useEffect(() => {
        if (workspace?.id) {
            fetchCategories();
        }
    }, [workspace?.id]);

    const fetchCategories = async () => {
        if (!workspace?.id) return;
        try {
            setLoading(true);
            setError(null);
            const response = await csrfFetch(`/api/admin/asset-categories?workspaceId=${workspace.id}`);
            if (!response.ok) throw new Error('Failed to fetch categories');
            const json = await response.json();
            setCategories(json.data?.categories || json.categories || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
            showError('Failed to load categories', err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const requestDelete = (id: string, name: string) => {
        setConfirmState({ open: true, id, name });
    };

    const deleteCategory = async () => {
        if (!confirmState) return;
        const { id, name } = confirmState;
        setConfirmState(null);

        try {
            const response = await csrfFetch(`/api/admin/asset-categories/${id}?workspaceId=${workspace?.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete category');
            }

            success(`Category "${name}" deleted successfully`);
            fetchCategories();
        } catch (err: unknown) {
            showError('Failed to delete category', err instanceof Error ? err.message : 'An unexpected error occurred');
        }
    };

    if (loading) {
        return <PageSpinner text="Loading categories..." />;
    }

    if (error) {
        return (
            <ErrorState
                title="Failed to load categories"
                description={error}
                onRetry={fetchCategories}
            />
        );
    }

    return (
        <>
            <ConfirmDialog
                open={!!confirmState?.open}
                title="Delete Category"
                message={`Delete category "${confirmState?.name}"? This will also delete all associated fields and actions.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={deleteCategory}
                onCancel={() => setConfirmState(null)}
            />
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Asset Categories</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage asset categories, fields, and actions</p>
                </div>
                <Link
                    href="/assets/categories/new"
                    className="btn-primary h-9 text-sm px-3 inline-flex items-center gap-1.5"
                >
                    <Plus size={14} />
                    New Category
                </Link>
            </div>

            {categories.length === 0 ? (
                <NoData resource="Categories" createHref="/assets/categories/new" />
            ) : (
                <div className="detail-panel p-0 overflow-hidden animate-fade-in">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-border bg-surface-1/60">
                                <tr>
                                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</th>
                                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {categories.map((category) => (
                                    <tr
                                        key={category.id}
                                        className="hover:bg-surface-1/50 transition-colors group"
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg h-8 w-8 flex items-center justify-center bg-surface-2 border border-border rounded-lg flex-shrink-0">{category.icon || '📁'}</span>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{category.name}</p>
                                                    <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">{category.slug}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary/[0.07] text-primary rounded border border-primary/20">
                                                {category.assetTypeValue}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {category.isActive ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium bg-health-good/10 text-health-good rounded border border-health-good/20">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-health-good"></span>Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium bg-muted/50 text-muted-foreground rounded border border-border">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></span>Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 max-w-[220px]">
                                            <p className="text-sm text-muted-foreground truncate">{category.description || '—'}</p>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Link
                                                    href={`/assets/categories/${category.id}/actions`}
                                                    className="px-2.5 py-1 text-xs font-medium text-primary bg-primary/[0.06] hover:bg-primary/[0.12] rounded transition-colors"
                                                >Actions</Link>
                                                <div className="w-px h-4 bg-border mx-0.5"></div>
                                                <Link
                                                    href={`/assets/categories/${category.id}/edit`}
                                                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded transition-colors"
                                                    aria-label={`Edit ${category.name}`}
                                                ><Edit2 size={14} /></Link>
                                                <button type="button"
                                                    onClick={() => requestDelete(category.id, category.name)}
                                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                                    aria-label={`Delete ${category.name}`}
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
        </>
    );
}
