'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/lib/toast';
import { ButtonSpinner } from '@/components/ui/Spinner';
import { CSRFToken, fetchWithCSRF } from '@/components/security/CSRFToken';

const categorySchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    slug: z.string().min(1, 'Slug is required').max(255).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),
    description: z.string().optional(),
    icon: z.string().optional(),
    type: z.enum(['PHYSICAL', 'DIGITAL']),
    parentId: z.string().optional(),
    isActive: z.boolean().default(true),
});

type CategoryFormData = z.input<typeof categorySchema>;

export default function NewCategoryPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const { success, error: showError } = useToast();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            type: 'PHYSICAL',
            isActive: true,
        },
    });

    const onSubmit = async (data: CategoryFormData) => {
        try {
            setLoading(true);

            const response = await fetchWithCSRF('/api/admin/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create category');
            }

            const result = await response.json();
            success(`Category "${data.name}" created successfully`);
            router.push('/admin/categories');
        } catch (err: unknown) {
            showError('Failed to create category', err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="max-w-2xl mx-auto px-4 py-8">
                <div className="mb-6">
                    <Link
                        href="/admin/categories"
                        className="inline-flex items-center gap-2 text-nerve hover:text-nerve mb-4"
                    >
                        <ArrowLeft size={20} />
                        Back to Categories
                    </Link>
                    <h1 className="text-3xl font-bold text-white ">Create New Category</h1>
                </div>



                <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                    <CSRFToken />
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
                                placeholder="e.g., Servers"
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
                                placeholder="e.g., servers"
                            />
                            {errors.slug && (
                                <p className="mt-1 text-sm text-health-critical">{errors.slug.message}</p>
                            )}
                            <p className="mt-1 text-sm text-slate-500">Lowercase with hyphens only</p>
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
                                placeholder="Describe this category..."
                            />
                            {errors.description && (
                                <p className="mt-1 text-sm text-health-critical">{errors.description.message}</p>
                            )}
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
                                placeholder="e.g., 🖥️"
                                maxLength={2}
                            />
                            {errors.icon && (
                                <p className="mt-1 text-sm text-health-critical">{errors.icon.message}</p>
                            )}
                        </div>

                        {/* Asset Type */}
                        <div>
                            <label htmlFor="type" className="block text-sm font-medium text-slate-300 mb-2">
                                Asset Type *
                            </label>
                            <select
                                {...register('type')}
                                id="type"
                                className="w-full px-4 py-2 border border-slate-700  rounded-lg bg-slate-800/50 text-white  focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                            >
                                <option value="PHYSICAL">Physical</option>
                                <option value="DIGITAL">Digital</option>
                            </select>
                            {errors.type && (
                                <p className="mt-1 text-sm text-health-critical">{errors.type.message}</p>
                            )}
                        </div>



                        {/* Active Checkbox */}
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

                    <div className="flex gap-3 mt-8 pt-6 border-t border-slate-800">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                        >
                            {loading && <ButtonSpinner />}
                            {loading ? 'Creating...' : 'Create Category'}
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
        </>
    );
}
