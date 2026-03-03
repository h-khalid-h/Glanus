'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2, FolderTree } from 'lucide-react';
import { AssetCategory } from '@prisma/client';
import { PageSpinner } from '@/components/ui/Spinner';
import { NoData, ErrorState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui';
import { useToast } from '@/lib/toast';

export default function CategoriesPage() {
    const [categories, setCategories] = useState<AssetCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { success, error: showError } = useToast();
    const [confirmState, setConfirmState] = useState<{ open: boolean; id: string; name: string } | null>(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await csrfFetch('/api/admin/categories');
            if (!response.ok) throw new Error('Failed to fetch categories');
            const data = await response.json();
            setCategories(data.categories || []);
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
            const response = await csrfFetch(`/api/admin/categories/${id}`, {
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
                    <h1 className="text-3xl font-bold text-white">Asset Categories</h1>
                    <p className="text-slate-400 mt-1">
                        Manage asset categories, fields, and actions
                    </p>
                </div>
                <Link
                    href="/admin/categories/new"
                    className="flex items-center gap-2 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110 transition-colors"
                >
                    <Plus size={20} />
                    New Category
                </Link>
            </div>

            {categories.length === 0 ? (
                <NoData resource="Categories" createHref="/admin/categories/new" />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categories.map((category) => (
                        <div
                            key={category.id}
                            className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6 hover:shadow-lg transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{category.icon || '📁'}</span>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">
                                            {category.name}
                                        </h3>
                                        <p className="text-sm text-slate-500">{category.slug}</p>
                                    </div>
                                </div>
                            </div>

                            {category.description && (
                                <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                                    {category.description}
                                </p>
                            )}

                            <div className="flex items-center gap-2 mb-4">
                                <span className="px-2 py-1 text-xs font-medium bg-nerve/10 text-nerve rounded">
                                    {category.assetTypeValue}
                                </span>
                                {category.isActive ? (
                                    <span className="px-2 py-1 text-xs font-medium bg-health-good/15 text-health-good rounded">
                                        Active
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 text-xs font-medium bg-slate-800/50 text-slate-200 rounded">
                                        Inactive
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-4 border-t border-slate-800">
                                <Link
                                    href={`/admin/categories/${category.id}/fields`}
                                    className="flex-1 text-center px-3 py-2 text-sm font-medium text-nerve hover:bg-nerve/5 rounded transition-colors"
                                >
                                    Fields
                                </Link>
                                <Link
                                    href={`/admin/categories/${category.id}/actions`}
                                    className="flex-1 text-center px-3 py-2 text-sm font-medium text-nerve hover:bg-nerve/5 rounded transition-colors"
                                >
                                    Actions
                                </Link>
                                <Link
                                    href={`/admin/categories/${category.id}/edit`}
                                    className="p-2 text-slate-400 hover:bg-slate-800/50 rounded transition-colors"
                                    aria-label={`Edit ${category.name}`}
                                >
                                    <Edit2 size={16} />
                                </Link>
                                <button type="button"
                                    onClick={() => requestDelete(category.id, category.name)}
                                    className="p-2 text-health-critical hover:bg-health-critical/10 rounded transition-colors"
                                    aria-label={`Delete ${category.name}`}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
