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
import { useWorkspace } from '@/lib/workspace/context';

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
    const { workspace } = useWorkspace();

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
            const parsedData: any = { ...data, workspaceId: workspace?.id };
            if (data.validationRules) {
                try {
                    JSON.parse(data.validationRules);
                } catch {
                    throw new Error('Validation rules must be valid JSON');
                }
            }

            const response = await csrfFetch(`/api/admin/asset-categories/${categoryId}/fields?workspaceId=${workspace?.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create field');
            }

            router.push(`/admin/asset-categories/${categoryId}/fields`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };


    if (error) return <ErrorState title="Something went wrong" description={error} onRetry={() => window.location.reload()} />;

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="mb-5">
                <Link
                    href={`/admin/asset-categories/${categoryId}/fields`}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                    <ArrowLeft size={14} />
                    Fields
                </Link>
                <h1 className="text-xl font-semibold text-foreground">Create New Field</h1>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-health-critical/10 border border-health-critical/20 rounded-lg">
                    <p className="text-sm text-health-critical">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="detail-panel">
                    <h3 className="detail-panel-title">Basic Information</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">Name *</label>
                            <input {...register('name')} type="text" id="name" className="input w-full" placeholder="e.g., hostname" />
                            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
                        </div>
                        <div>
                            <label htmlFor="label" className="block text-sm font-medium text-foreground mb-1.5">Label *</label>
                            <input {...register('label')} type="text" id="label" className="input w-full" placeholder="e.g., Hostname" />
                            {errors.label && <p className="mt-1 text-xs text-destructive">{errors.label.message}</p>}
                        </div>
                    </div>

                    <div className="mt-4">
                        <label htmlFor="slug" className="block text-sm font-medium text-foreground mb-1.5">Slug *</label>
                        <input {...register('slug')} type="text" id="slug" className="input w-full" placeholder="e.g., hostname" />
                        {errors.slug && <p className="mt-1 text-xs text-destructive">{errors.slug.message}</p>}
                        <p className="mt-1 text-xs text-muted-foreground">Lowercase with underscores only</p>
                    </div>

                    <div className="mt-4">
                        <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                        <textarea {...register('description')} id="description" rows={2} className="input w-full resize-none" placeholder="Describe this field..." />
                    </div>
                </div>

                <div className="detail-panel">
                    <h3 className="detail-panel-title">Field Configuration</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="fieldType" className="block text-sm font-medium text-foreground mb-1.5">Field Type *</label>
                            <select {...register('fieldType')} id="fieldType" className="input w-full">
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
                            <label htmlFor="sortOrder" className="block text-sm font-medium text-foreground mb-1.5">Sort Order</label>
                            <input {...register('sortOrder', { valueAsNumber: true })} type="number" id="sortOrder" className="input w-full" min="0" />
                        </div>
                    </div>

                    <div className="mt-4">
                        <label htmlFor="defaultValue" className="block text-sm font-medium text-foreground mb-1.5">Default Value</label>
                        <input {...register('defaultValue')} type="text" id="defaultValue" className="input w-full" placeholder={fieldType === 'BOOLEAN' ? 'true or false' : 'Default value...'} />
                    </div>

                    <div className="mt-4">
                        <label htmlFor="validationRules" className="block text-sm font-medium text-foreground mb-1.5">Validation Rules (JSON)</label>
                        <textarea {...register('validationRules')} id="validationRules" rows={3} className="input w-full font-mono text-xs resize-none" placeholder='{"min": 0, "max": 100}' />
                        {errors.validationRules && <p className="mt-1 text-xs text-destructive">{errors.validationRules.message}</p>}
                        <p className="mt-1 text-xs text-muted-foreground">Must be valid JSON</p>
                    </div>
                </div>

                <div className="detail-panel">
                    <h3 className="detail-panel-title">UI Hints</h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="placeholder" className="block text-sm font-medium text-foreground mb-1.5">Placeholder</label>
                            <input {...register('placeholder')} type="text" id="placeholder" className="input w-full" placeholder="Enter placeholder text..." />
                        </div>
                        <div>
                            <label htmlFor="helpText" className="block text-sm font-medium text-foreground mb-1.5">Help Text</label>
                            <textarea {...register('helpText')} id="helpText" rows={2} className="input w-full resize-none" placeholder="Additional help text for users..." />
                        </div>
                        <div>
                            <label htmlFor="group" className="block text-sm font-medium text-foreground mb-1.5">Group (Optional)</label>
                            <input {...register('group')} type="text" id="group" className="input w-full" placeholder="e.g., Network Configuration" />
                        </div>
                    </div>
                </div>

                <div className="detail-panel">
                    <h3 className="detail-panel-title">Field Flags</h3>
                    <div className="grid grid-cols-2 gap-2.5">
                        {([
                            { id: 'isRequired', label: 'Required' },
                            { id: 'isUnique', label: 'Unique' },
                            { id: 'isVisible', label: 'Visible in forms' },
                            { id: 'isSearchable', label: 'Searchable' },
                            { id: 'isInherited', label: 'Inherited' },
                        ] as const).map(({ id, label }) => (
                            <div key={id} className="flex items-center gap-2 p-2.5 bg-surface-1/50 border border-border rounded-lg">
                                <input {...register(id)} type="checkbox" id={id} className="h-4 w-4 rounded border-border accent-primary" />
                                <label htmlFor={id} className="text-sm text-foreground">{label}</label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                    <Link href={`/admin/asset-categories/${categoryId}/fields`} className="btn-secondary h-9 text-sm px-4">Cancel</Link>
                    <button type="submit" disabled={loading} className="btn-primary h-9 text-sm px-4 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent" /> Creating…</> : 'Create Field'}
                    </button>
                </div>
            </form>
        </div>
    );
}
