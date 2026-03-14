'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { AssetActionDefinition } from '@prisma/client';
import { ArrowLeft } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';

export default function ActionsPage({ params }: { params: Promise<{ id: string }> }) {
    const { error: showError } = useToast();
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [categoryName, setCategoryName] = useState<string>('');
    const [actions, setActions] = useState<AssetActionDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmActionId, setConfirmActionId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const resolvedParams = await params;
            setCategoryId(resolvedParams.id);
            fetchActions(resolvedParams.id);
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

    const fetchActions = async (id: string) => {
        try {
            setLoading(true);
            const response = await csrfFetch(`/api/admin/categories/${id}/actions`);
            if (!response.ok) throw new Error('Failed to fetch actions');
            const data = await response.json();
            setActions(data.sort((a: AssetActionDefinition, b: AssetActionDefinition) => a.sortOrder - b.sortOrder));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const requestDeleteAction = (actionId: string) => {
        setConfirmActionId(actionId);
    };

    const deleteAction = async () => {
        const actionId = confirmActionId;
        setConfirmActionId(null);
        if (!actionId) return;

        try {
            const response = await csrfFetch(`/api/admin/actions/${actionId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete action');

            if (categoryId) fetchActions(categoryId);
        } catch (err: unknown) {
            showError('Action failed', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    if (loading) return <div className="container mx-auto px-4 py-8"><p className="text-slate-400">Loading actions...</p></div>;
    if (error) return <div className="container mx-auto px-4 py-8"><p className="text-health-critical">Error: {error}</p></div>;

    return (
        <div className="container mx-auto px-4 py-8">
            <ConfirmDialog
                open={!!confirmActionId}
                title="Delete Action"
                message="Are you sure you want to delete this action? It will be removed from all assets in this category."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={deleteAction}
                onCancel={() => setConfirmActionId(null)}
            />
            <div className="mb-6">
                <Link href="/admin/categories" className="inline-flex items-center gap-2 text-nerve hover:text-nerve mb-4">
                    <ArrowLeft size={20} />
                    Back to Categories
                </Link>
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Action Definitions</h1>
                        <p className="text-slate-400 mt-1">Category: {categoryName}</p>
                    </div>
                    <Link
                        href={`/admin/categories/${categoryId}/actions/new`}
                        className="flex items-center gap-2 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110"
                    >
                        <Plus size={20} />
                        New Action
                    </Link>
                </div>
            </div>

            {actions.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/30 rounded-lg">
                    <p className="text-lg text-slate-400 mb-4">No actions defined yet</p>
                    <Link
                        href={`/admin/categories/${categoryId}/actions/new`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110"
                    >
                        <Plus size={20} />
                        Create First Action
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {actions.map((action) => (
                        <div key={action.id} className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{action.icon || '⚡'}</span>
                                    <div>
                                        <h3 className="text-lg font-semibold text-foreground">{action.label}</h3>
                                        <p className="text-sm text-slate-500">{action.slug}</p>
                                    </div>
                                </div>
                            </div>

                            {action.description && (
                                <p className="text-sm text-slate-400 mb-4 line-clamp-2">{action.description}</p>
                            )}

                            <div className="flex items-center gap-2 mb-4">
                                <span className="px-2 py-1 text-xs font-medium bg-nerve/10 text-nerve rounded">
                                    {action.handlerType}
                                </span>
                                {action.requiresConfirmation && (
                                    <span className="px-2 py-1 text-xs font-medium bg-health-warn/15 text-health-warn rounded">
                                        Confirmation
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-4 border-t border-slate-800">
                                <Link
                                    href={`/admin/categories/${categoryId}/actions/${action.id}/edit`}
                                    className="flex-1 text-center px-3 py-2 text-sm font-medium text-nerve hover:bg-nerve/5 rounded"
                                >
                                    <Edit2 size={16} className="inline mr-1" />
                                    Edit
                                </Link>
                                <button type="button"
                                    onClick={() => requestDeleteAction(action.id)}
                                    className="p-2 text-health-critical hover:bg-health-critical/10 rounded"
                                    aria-label={`Delete ${action.label}`}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
