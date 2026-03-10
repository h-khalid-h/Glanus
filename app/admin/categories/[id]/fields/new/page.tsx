'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const fieldSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    label: z.string().min(1, 'Label is required').max(255),
    slug: z.string().min(1, 'Slug is required').max(255).regex(/^[a-z0-9_]+$/, 'Slug must be lowercase with underscores'),
    description: z.string().optional(),
    fieldType: z.enum(['STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'JSON', 'ENUM', 'TEXT'], {
        required_error: 'Field type is required',
    }),
    isRequired: z.boolean().default(false),
    isUnique: z.boolean().default(false),
    isInherited: z.boolean().default(false),
    defaultValue: z.string().optional(),
    validationRules: z.string().optional(),
    sortOrder: z.number().int().min(0).default(0),
    isVisible: z.boolean().default(true),
    isSearchable: z.boolean().default(false),
    group: z.string().optional(),
    placeholder: z.string().optional(),
    helpText: z.string().optional(),
});

type FieldFormData = z.input<typeof fieldSchema>;

export default function NewFieldPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<FieldFormData>({
        resolver: zodResolver(fieldSchema),
        defaultValues: {
            fieldType: 'STRING',
            isRequired: false,
            isUnique: false,
            isInherited: false,
            sortOrder: 0,
            isVisible: true,
            isSearchable: false,
        },
    });

    const fieldType = watch('fieldType');

    useEffect(() => {
        const init = async () => {
            const resolvedParams = await params;
            setCategoryId(resolvedParams.id);
        };
        init();
    }, [params]);

    const onSubmit = async (data: FieldFormData) => {
        if (!categoryId) return;

        try {
            setLoading(true);
            setError(null);

            // Parse validation rules if provided
            const parsedData = { ...data };
            if (data.validationRules) {
                try {
                    JSON.parse(data.validationRules);
                } catch {
                    throw new Error('Validation rules must be valid JSON');
                }
            }

            const response = await csrfFetch(`/api/admin/categories/${categoryId}/fields`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create field');
            }

            router.push(`/admin/categories/${categoryId}/fields`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };


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
                <h1 className="text-3xl font-bold text-foreground">Create New Field</h1>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-health-critical/10 border border-health-critical/20 rounded-lg">
                    <p className="text-sm text-health-critical">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                <div className="space-y-6">
                    {/* Basic Info Section */}
                    <div className="pb-6 border-b border-slate-800">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Basic Information</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                                    Name *
                                </label>
                                <input
                                    {...register('name')}
                                    type="text"
                                    id="name"
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    placeholder="e.g., hostname"
                                />
                                {errors.name && (
                                    <p className="mt-1 text-sm text-health-critical">{errors.name.message}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="label" className="block text-sm font-medium text-slate-300 mb-2">
                                    Label *
                                </label>
                                <input
                                    {...register('label')}
                                    type="text"
                                    id="label"
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    placeholder="e.g., Hostname"
                                />
                                {errors.label && (
                                    <p className="mt-1 text-sm text-health-critical">{errors.label.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-4">
                            <label htmlFor="slug" className="block text-sm font-medium text-slate-300 mb-2">
                                Slug *
                            </label>
                            <input
                                {...register('slug')}
                                type="text"
                                id="slug"
                                className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                placeholder="e.g., hostname"
                            />
                            {errors.slug && (
                                <p className="mt-1 text-sm text-health-critical">{errors.slug.message}</p>
                            )}
                            <p className="mt-1 text-sm text-slate-500">Lowercase with underscores only</p>
                        </div>

                        <div className="mt-4">
                            <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
                                Description
                            </label>
                            <textarea
                                {...register('description')}
                                id="description"
                                rows={2}
                                className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                placeholder="Describe this field..."
                            />
                        </div>
                    </div>

                    {/* Field Type Section */}
                    <div className="pb-6 border-b border-slate-800">
                        <h3 className="text-lg font-semibold text-white mb-4">Field Configuration</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="fieldType" className="block text-sm font-medium text-slate-300 mb-2">
                                    Field Type *
                                </label>
                                <select
                                    {...register('fieldType')}
                                    id="fieldType"
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
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
                        </div>

                        <div className="mt-4">
                            <label htmlFor="defaultValue" className="block text-sm font-medium text-slate-300 mb-2">
                                Default Value
                            </label>
                            <input
                                {...register('defaultValue')}
                                type="text"
                                id="defaultValue"
                                className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                placeholder={fieldType === 'BOOLEAN' ? 'true or false' : 'Default value...'}
                            />
                        </div>

                        <div className="mt-4">
                            <label htmlFor="validationRules" className="block text-sm font-medium text-slate-300 mb-2">
                                Validation Rules (JSON)
                            </label>
                            <textarea
                                {...register('validationRules')}
                                id="validationRules"
                                rows={3}
                                className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50 font-mono text-sm"
                                placeholder='{"min": 0, "max": 100}'
                            />
                            {errors.validationRules && (
                                <p className="mt-1 text-sm text-health-critical">{errors.validationRules.message}</p>
                            )}
                            <p className="mt-1 text-sm text-slate-500">Must be valid JSON</p>
                        </div>
                    </div>

                    {/* UI Hints Section */}
                    <div className="pb-6 border-b border-slate-800">
                        <h3 className="text-lg font-semibold text-white mb-4">UI Hints</h3>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="placeholder" className="block text-sm font-medium text-slate-300 mb-2">
                                    Placeholder
                                </label>
                                <input
                                    {...register('placeholder')}
                                    type="text"
                                    id="placeholder"
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    placeholder="Enter placeholder text..."
                                />
                            </div>

                            <div>
                                <label htmlFor="helpText" className="block text-sm font-medium text-slate-300 mb-2">
                                    Help Text
                                </label>
                                <textarea
                                    {...register('helpText')}
                                    id="helpText"
                                    rows={2}
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    placeholder="Additional help text for users..."
                                />
                            </div>

                            <div>
                                <label htmlFor="group" className="block text-sm font-medium text-slate-300 mb-2">
                                    Group (Optional)
                                </label>
                                <input
                                    {...register('group')}
                                    type="text"
                                    id="group"
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    placeholder="e.g., Network Configuration"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Flags Section */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4">Field Flags</h3>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center">
                                <input
                                    {...register('isRequired')}
                                    type="checkbox"
                                    id="isRequired"
                                    className="h-4 w-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                                />
                                <label htmlFor="isRequired" className="ml-2 text-sm text-slate-300">
                                    Required
                                </label>
                            </div>

                            <div className="flex items-center">
                                <input
                                    {...register('isUnique')}
                                    type="checkbox"
                                    id="isUnique"
                                    className="h-4 w-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                                />
                                <label htmlFor="isUnique" className="ml-2 text-sm text-slate-300">
                                    Unique
                                </label>
                            </div>

                            <div className="flex items-center">
                                <input
                                    {...register('isVisible')}
                                    type="checkbox"
                                    id="isVisible"
                                    className="h-4 w-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                                />
                                <label htmlFor="isVisible" className="ml-2 text-sm text-slate-300">
                                    Visible in forms
                                </label>
                            </div>

                            <div className="flex items-center">
                                <input
                                    {...register('isSearchable')}
                                    type="checkbox"
                                    id="isSearchable"
                                    className="h-4 w-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                                />
                                <label htmlFor="isSearchable" className="ml-2 text-sm text-slate-300">
                                    Searchable
                                </label>
                            </div>

                            <div className="flex items-center">
                                <input
                                    {...register('isInherited')}
                                    type="checkbox"
                                    id="isInherited"
                                    className="h-4 w-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                                />
                                <label htmlFor="isInherited" className="ml-2 text-sm text-slate-300">
                                    Inherited
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8 pt-6 border-t border-slate-800">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Creating...' : 'Create Field'}
                    </button>
                    <Link
                        href={`/admin/categories/${categoryId}/fields`}
                        className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-900/30 transition-colors"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    );
}
