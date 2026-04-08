'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';

import { useWorkspace } from '@/lib/workspace/context';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2, Zap } from 'lucide-react';
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
    const { workspace } = useWorkspace();

    useEffect(() => {
        const init = async () => {
            if (!workspace?.id) return;
            const resolvedParams = await params;
            setCategoryId(resolvedParams.id);
            fetchActions(resolvedParams.id, workspace.id);
            fetchCategory(resolvedParams.id, workspace.id);
        };
        init();
    }, [params, workspace?.id]);

    const fetchCategory = async (id: string, wsId: string) => {
        try {
            const response = await csrfFetch(`/api/admin/asset-categories/${id}?workspaceId=${wsId}`);
            if (!response.ok) throw new Error('Failed to fetch category');
            const json = await response.json();
            const data = json.data || json;
            setCategoryName(data.name);
        } catch (err: unknown) {
            showError('Error fetching category:', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    const fetchActions = async (id: string, wsId: string) => {
        try {
            setLoading(true);
            const response = await csrfFetch(`/api/admin/asset-categories/${id}/actions?workspaceId=${wsId}`);
            if (!response.ok) throw new Error('Failed to fetch actions');
            const json = await response.json();
            const actionsList = json.data?.actions || json.actions || json.data || json || [];
            if (Array.isArray(actionsList)) {
                setActions(actionsList.sort((a: AssetActionDefinition, b: AssetActionDefinition) => a.sortOrder - b.sortOrder));
            } else { setActions([]); }
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
            const response = await csrfFetch(`/api/admin/actions/${actionId}?workspaceId=${workspace?.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete action');

            if (categoryId && workspace?.id) fetchActions(categoryId, workspace.id);
        } catch (err: unknown) {
            showError('Action failed', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    if (loading) return <PageSpinner text="Loading actions..." />;
    if (error) return <div className="max-w-4xl mx-auto py-8"><p className="text-destructive text-sm">Error: {error}</p></div>;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <ConfirmDialog
                open={!!confirmActionId}
                title="Delete Action"
                message="Are you sure you want to delete this action? It will be removed from all assets in this category."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={deleteAction}
                onCancel={() => setConfirmActionId(null)}
            />
            <div className="mb-5">
                <Link href="/workspaces/manage/categories" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
                    <ArrowLeft size={14} />
                    Categories
                </Link>
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">Action Definitions</h1>
                        {categoryName && <p className="text-sm text-muted-foreground mt-0.5">{categoryName}</p>}
                    </div>
                    <Link
                        href={`/workspaces/manage/categories/${categoryId}/actions/new`}
                        className="btn-primary h-9 text-sm px-3 inline-flex items-center gap-1.5"
                    >
                        <Plus size={14} />
                        New Action
                    </Link>
                </div>
            </div>

            {actions.length === 0 ? (
                <div className="detail-panel text-center py-16">
                    <div className="h-10 w-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center mx-auto mb-3">
                        <Zap size={16} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">No actions defined yet</p>
                    <p className="text-xs text-muted-foreground mb-4">Actions define automated workflows for assets in this category.</p>
                    <Link
                        href={`/workspaces/manage/categories/${categoryId}/actions/new`}
                        className="btn-primary h-8 text-xs px-3 inline-flex items-center gap-1.5"
                    >
                        <Plus size={12} /> Create First Action
                    </Link>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {actions.map((action) => (
                        <div key={action.id} className="detail-panel flex flex-col gap-3">
                            <div className="flex items-start gap-3">
                                <span className="text-xl leading-none mt-0.5">{action.icon || '⚡'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{action.label}</p>
                                    <p className="text-xs text-muted-foreground/70 font-mono">{action.slug}</p>
                                </div>
                            </div>

                            {action.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
                            )}

                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded border border-primary/20">
                                    {action.handlerType}
                                </span>
                                {action.requiresConfirmation && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-oracle/10 text-oracle rounded border border-oracle/20">
                                        Confirmation
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5 pt-2 border-t border-border/60">
                                <Link
                                    href={`/workspaces/manage/categories/${categoryId}/actions/${action.id}/edit`}
                                    className="flex-1 inline-flex justify-center items-center gap-1.5 h-7 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
                                >
                                    <Edit2 size={12} /> Edit
                                </Link>
                                <div className="w-px h-4 bg-border" />
                                <button type="button"
                                    onClick={() => requestDeleteAction(action.id)}
                                    className="flex-1 inline-flex justify-center items-center gap-1.5 h-7 text-xs font-medium text-destructive hover:bg-destructive/10 rounded transition-colors"
                                    aria-label={`Delete ${action.label}`}
                                >
                                    <Trash2 size={12} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
