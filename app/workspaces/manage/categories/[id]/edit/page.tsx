'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Box, LayoutGrid, Settings, Info } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/lib/toast';
import { ButtonSpinner } from '@/components/ui/Spinner';
import { CSRFToken, fetchWithCSRF } from '@/components/security/CSRFToken';
import { ErrorState } from '@/components/ui/EmptyState';
import { useWorkspace } from '@/lib/workspace/context';

const categorySchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().optional(),
    icon: z.string().optional(),
    assetTypeValue: z.enum(['PHYSICAL', 'DIGITAL']),
    parentId: z.string().optional(),
    isActive: z.boolean().default(true),
    allowsChildren: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
});

type CategoryFormData = z.input<typeof categorySchema>;

interface Category {
    id: string;
    name: string;
    allowsChildren: boolean;
}

export default function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { workspace } = useWorkspace();
    const resolvedParams = use(params);
    const categoryId = resolvedParams.id;
    
    const [loading, setLoading] = useState(false);
    const [fetchingData, setFetchingData] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const [error, setError] = useState<string | null>(null);
    const { success, error: showError } = useToast();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            assetTypeValue: 'PHYSICAL',
            isActive: true,
            allowsChildren: true,
            parentId: '',
            sortOrder: 0,
        },
    });

    useEffect(() => {
        const init = async () => {
            if (!workspace?.id) return;
            try {
                // Fetch existing category data AND possible parents in parallel
                const [itemRes, catsRes] = await Promise.all([
                    fetchWithCSRF(`/api/admin/asset-categories/${categoryId}?workspaceId=${workspace.id}`),
                    fetchWithCSRF(`/api/admin/asset-categories?workspaceId=${workspace.id}`)
                ]);

                if (!itemRes.ok) throw new Error('Failed to fetch category');
                
                const itemJson = await itemRes.json();
                const itemData = itemJson.data || itemJson;
                
                reset({
                    name: itemData.name,
                    description: itemData.description || '',
                    icon: itemData.icon || '',
                    assetTypeValue: itemData.assetTypeValue,
                    parentId: itemData.parentId || '',
                    allowsChildren: itemData.allowsChildren,
                    isActive: itemData.isActive,
                    sortOrder: itemData.sortOrder,
                });

                if (catsRes.ok) {
                    const catsJson = await catsRes.json();
                    const list = catsJson.data?.categories || catsJson.categories || [];
                    // Exclude self from potential parents to prevent recursive loops
                    setCategories(list.filter((c: Category) => c.id !== categoryId));
                }
            } catch (err) {
                console.error('Failed to fetch data:', err);
                setError(err instanceof Error ? err.message : 'Something went wrong');
            } finally {
                setFetchingData(false);
            }
        };

        if (categoryId && workspace?.id) {
            init();
        }
    }, [categoryId, workspace?.id, reset]);

    const onSubmit = async (data: CategoryFormData) => {
        try {
            if (!workspace?.id) return;
            setLoading(true);

            const payload = {
                ...data,
                parentId: data.parentId === '' ? undefined : data.parentId,
                workspaceId: workspace.id,
            };

            const response = await fetchWithCSRF(`/api/admin/asset-categories/${categoryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update category');
            }

            success(`Category "${data.name}" updated successfully`);
            router.push('/workspaces/manage/categories');
        } catch (err: unknown) {
            showError('Failed to update category', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    if (error) return <ErrorState title="Something went wrong" description={error} onRetry={() => window.location.reload()} />;



    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <div className="mb-6">
                <Link
                    href="/workspaces/manage/categories"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                    <ArrowLeft size={14} />
                    Categories
                </Link>
                <h1 className="text-xl font-semibold text-foreground">Edit Category</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Modify the classification settings for this tracking group.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <CSRFToken />

                <div className="detail-panel">
                    <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/60">
                        <div className="h-7 w-7 flex items-center justify-center bg-primary/10 text-primary rounded-lg border border-primary/20">
                            <LayoutGrid size={14} />
                        </div>
                        <h2 className="text-sm font-semibold text-foreground">Basic Details</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
                                Category Name <span className="text-destructive">*</span>
                            </label>
                            <input
                                {...register('name')}
                                type="text"
                                id="name"
                                className="input w-full"
                                placeholder="e.g., Network Switches"
                            />
                            {errors.name && <p className="mt-1.5 text-xs text-destructive flex items-center gap-1"><Info size={12} /> {errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="icon" className="block text-sm font-medium text-foreground mb-1.5">Icon</label>
                                <div className="relative">
                                    <input
                                        {...register('icon')}
                                        type="text"
                                        id="icon"
                                        className="input w-full pl-9"
                                        placeholder="e.g., 🖧"
                                        maxLength={2}
                                    />
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                                        <Box size={14} />
                                    </div>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">Pick a recognizable emoji.</p>
                                {errors.icon && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><Info size={12} /> {errors.icon.message}</p>}
                            </div>
                            <div>
                                <label htmlFor="sortOrder" className="block text-sm font-medium text-foreground mb-1.5">Sort Order</label>
                                <input
                                    {...register('sortOrder', { valueAsNumber: true })}
                                    type="number"
                                    id="sortOrder"
                                    min="0"
                                    className="input w-full"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">Order in sidebar dropdowns.</p>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1.5">
                                Description <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                            </label>
                            <textarea
                                {...register('description')}
                                id="description"
                                rows={3}
                                className="input w-full resize-none"
                                placeholder="Briefly describe the assets in this category..."
                            />
                            {errors.description && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><Info size={12} /> {errors.description.message}</p>}
                        </div>
                    </div>
                </div>

                <div className="detail-panel">
                    <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/60">
                        <div className="h-7 w-7 flex items-center justify-center bg-cortex/10 text-cortex rounded-lg border border-cortex/20">
                            <Settings size={14} />
                        </div>
                        <h2 className="text-sm font-semibold text-foreground">Configuration</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="assetTypeValue" className="block text-sm font-medium text-foreground mb-1.5">Asset Class</label>
                            <select
                                {...register('assetTypeValue')}
                                id="assetTypeValue"
                                className="input w-full sm:w-1/2"
                            >
                                <option value="PHYSICAL">Physical Hardware</option>
                                <option value="DIGITAL">Digital / Software Entity</option>
                            </select>
                            <p className="mt-1 text-xs text-muted-foreground">Determines which specialized workflows apply.</p>
                            {errors.assetTypeValue && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><Info size={12} /> {errors.assetTypeValue.message}</p>}
                        </div>

                        <div className="pt-3 border-t border-border/60">
                            <label htmlFor="parentId" className="block text-sm font-medium text-foreground mb-1.5">Category Level</label>
                            <select
                                {...register('parentId')}
                                id="parentId"
                                className="input w-full disabled:opacity-50"
                                disabled={fetchingData}
                            >
                                <option value="">Top-Level Category</option>
                                {categories.filter(c => c.allowsChildren).map(cat => (
                                    <option key={cat.id} value={cat.id}>Subcategory of: {cat.name}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-muted-foreground">Select a parent to make this a nested subcategory.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/60">
                            <div className="flex items-center justify-between p-3.5 bg-surface-1/50 border border-border rounded-lg">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Active Category</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Selectable for new assets</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input {...register('isActive')} type="checkbox" className="sr-only peer" />
                                    <div className="w-9 h-5 bg-border rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between p-3.5 bg-surface-1/50 border border-border rounded-lg">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Allow Subcategories</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Enable child categories</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input {...register('allowsChildren')} type="checkbox" className="sr-only peer" />
                                    <div className="w-9 h-5 bg-border rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <p className="text-xs text-muted-foreground">
                        {isDirty ? (
                            <span className="text-oracle flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-oracle animate-pulse" />
                                Unsaved changes
                            </span>
                        ) : 'No changes'}
                    </p>
                    <div className="flex gap-2.5">
                        <Link href="/workspaces/manage/categories" className="btn-secondary h-9 text-sm px-4">Cancel</Link>
                        <button
                            type="submit"
                            disabled={loading || !isDirty}
                            className="btn-primary h-9 text-sm px-4 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading && <ButtonSpinner />}
                            {loading ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
