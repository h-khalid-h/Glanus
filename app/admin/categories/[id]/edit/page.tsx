'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const categorySchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    slug: z.string().min(1, 'Slug is required').max(255).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),
    description: z.string().optional(),
    icon: z.string().optional(),
    assetTypeValue: z.enum(['PHYSICAL', 'DIGITAL']),
    parentId: z.string().optional(),
    allowsChildren: z.boolean().default(true),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
});

type CategoryFormData = z.input<typeof categorySchema>;

export default function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema),
    });

    useEffect(() => {
        const fetchCategory = async () => {
            try {
                const resolvedParams = await params;
                setCategoryId(resolvedParams.id);

                const response = await csrfFetch(`/api/admin/categories/${resolvedParams.id}`);
                if (!response.ok) throw new Error('Failed to fetch category');

                const data = await response.json();
                reset({
                    name: data.name,
                    slug: data.slug,
                    description: data.description || '',
                    icon: data.icon || '',
                    assetTypeValue: data.assetTypeValue,
                    parentId: data.parentId || '',
                    allowsChildren: data.allowsChildren,
                    isActive: data.isActive,
                    sortOrder: data.sortOrder,
                });
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'An unexpected error occurred');
            } finally {
                setFetching(false);
            }
        };

        fetchCategory();
    }, [params, reset]);

    const onSubmit = async (data: CategoryFormData) => {
        if (!categoryId) return;

        try {
            setLoading(true);
            setError(null);

            const response = await csrfFetch(`/api/admin/categories/${categoryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update category');
            }

            router.push('/admin/categories');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="container mx-auto px-4 py-8">
                <p className="text-slate-400">Loading category...</p>
            </div>
        );
    }

    if (error && !categoryId) {
        return (
            <div className="container mx-auto px-4 py-8">
                <p className="text-health-critical">Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <div className="mb-6">
                <Link
                    href="/admin/categories"
                    className="inline-flex items-center gap-2 text-nerve hover:text-nerve mb-4"
                >
                    <ArrowLeft size={20} />
                    Back to Categories
                </Link>
                <h1 className="text-3xl font-bold text-white">Edit Category</h1>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-health-critical/10 border border-health-critical/20 rounded-lg">
                    <p className="text-sm text-health-critical">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                <div className="space-y-6">
                    {/* Name */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                            Name *
                        </label>
                        <input
                            {...register('name')}
                            type="text"
                            id="name"
                            className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                        />
                        {errors.name && (
                            <p className="mt-1 text-sm text-health-critical">{errors.name.message}</p>
                        )}
                    </div>

                    {/* Slug */}
                    <div>
                        <label htmlFor="slug" className="block text-sm font-medium text-slate-300 mb-2">
                            Slug *
                        </label>
                        <input
                            {...register('slug')}
                            type="text"
                            id="slug"
                            className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                        />
                        {errors.slug && (
                            <p className="mt-1 text-sm text-health-critical">{errors.slug.message}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
                            Description
                        </label>
                        <textarea
                            {...register('description')}
                            id="description"
                            rows={3}
                            className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                        />
                    </div>

                    {/* Icon */}
                    <div>
                        <label htmlFor="icon" className="block text-sm font-medium text-slate-300 mb-2">
                            Icon (Emoji)
                        </label>
                        <input
                            {...register('icon')}
                            type="text"
                            id="icon"
                            className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                            maxLength={2}
                        />
                    </div>

                    {/* Asset Type */}
                    <div>
                        <label htmlFor="assetTypeValue" className="block text-sm font-medium text-slate-300 mb-2">
                            Asset Type *
                        </label>
                        <select
                            {...register('assetTypeValue')}
                            id="assetTypeValue"
                            className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                        >
                            <option value="PHYSICAL">Physical</option>
                            <option value="DIGITAL">Digital</option>
                        </select>
                    </div>

                    {/* Sort Order */}
                    <div>
                        <label htmlFor="sortOrder" className="block text-sm font-medium text-slate-300 mb-2">
                            Sort Order
                        </label>
                        <input
                            {...register('sortOrder', { valueAsNumber: true })}
                            type="number"
                            id="sortOrder"
                            className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                            min="0"
                        />
                    </div>

                    {/* Checkboxes */}
                    <div className="space-y-3">
                        <div className="flex items-center">
                            <input
                                {...register('allowsChildren')}
                                type="checkbox"
                                id="allowsChildren"
                                className="h-4 w-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                            />
                            <label htmlFor="allowsChildren" className="ml-2 text-sm text-slate-300">
                                Allow child categories
                            </label>
                        </div>

                        <div className="flex items-center">
                            <input
                                {...register('isActive')}
                                type="checkbox"
                                id="isActive"
                                className="h-4 w-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                            />
                            <label htmlFor="isActive" className="ml-2 text-sm text-slate-300">
                                Active
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8 pt-6 border-t border-slate-800">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <Link
                        href="/admin/categories"
                        className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-900/30 transition-colors"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    );
}
