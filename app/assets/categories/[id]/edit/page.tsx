'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Box, LayoutGrid, Settings, Info, Plus, Edit2, Trash2, X, Check, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/lib/toast';
import { ButtonSpinner, PageSpinner } from '@/components/ui/Spinner';
import { CSRFToken, fetchWithCSRF } from '@/components/security/CSRFToken';
import { ErrorState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui';
import { useWorkspace } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';

// --- Schemas ---
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

interface FieldDefinition {
    id: string;
    name: string;
    label: string;
    slug: string;
    description?: string;
    fieldType: string;
    isRequired: boolean;
    isUnique: boolean;
    isVisible: boolean;
    isSearchable: boolean;
    isInherited: boolean;
    defaultValue?: string;
    validationRules?: string;
    sortOrder: number;
    placeholder?: string;
    helpText?: string;
    group?: string;
}

const FIELD_TYPES = [
    { value: 'STRING', label: 'String' },
    { value: 'NUMBER', label: 'Number' },
    { value: 'DATE', label: 'Date' },
    { value: 'BOOLEAN', label: 'Boolean' },
    { value: 'JSON', label: 'JSON' },
    { value: 'ENUM', label: 'Enum' },
    { value: 'TEXT', label: 'Text (Long)' },
] as const;

const emptyField = {
    name: '', label: '', slug: '', description: '', fieldType: 'STRING',
    isRequired: false, isUnique: false, isVisible: true, isSearchable: false,
    isInherited: false, defaultValue: '', validationRules: '', sortOrder: 0,
    placeholder: '', helpText: '', group: '',
};

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

    // Fields state
    const [fields, setFields] = useState<FieldDefinition[]>([]);
    const [fieldFormOpen, setFieldFormOpen] = useState(false);
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
    const [fieldForm, setFieldForm] = useState<typeof emptyField>({ ...emptyField });
    const [fieldSaving, setFieldSaving] = useState(false);
    const [confirmDeleteField, setConfirmDeleteField] = useState<{ id: string; label: string } | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

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

    // Fetch category + parent cats + fields
    useEffect(() => {
        const init = async () => {
            if (!workspace?.id) return;
            try {
                const [itemRes, catsRes, fieldsRes] = await Promise.all([
                    fetchWithCSRF(`/api/admin/asset-categories/${categoryId}?workspaceId=${workspace.id}`),
                    fetchWithCSRF(`/api/admin/asset-categories?workspaceId=${workspace.id}`),
                    csrfFetch(`/api/admin/asset-categories/${categoryId}/fields?workspaceId=${workspace.id}`),
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
                    setCategories(list.filter((c: Category) => c.id !== categoryId));
                }

                if (fieldsRes.ok) {
                    const fieldsJson = await fieldsRes.json();
                    const fieldsList = fieldsJson.data?.fields || fieldsJson.fields || [];
                    setFields(fieldsList.sort((a: FieldDefinition, b: FieldDefinition) => a.sortOrder - b.sortOrder));
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Something went wrong');
            } finally {
                setFetchingData(false);
            }
        };

        if (categoryId && workspace?.id) init();
    }, [categoryId, workspace?.id, reset]);

    // --- Category save ---
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
            router.push('/assets/categories');
        } catch (err: unknown) {
            showError('Failed to update category', err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    // --- Field CRUD ---
    const openAddField = () => {
        setEditingFieldId(null);
        setFieldForm({ ...emptyField, sortOrder: fields.length });
        setFieldFormOpen(true);
        setShowAdvanced(false);
    };

    const openEditField = (field: FieldDefinition) => {
        setEditingFieldId(field.id);
        setFieldForm({
            name: field.name || '',
            label: field.label || '',
            slug: field.slug || '',
            description: field.description || '',
            fieldType: field.fieldType || 'STRING',
            isRequired: field.isRequired,
            isUnique: field.isUnique,
            isVisible: field.isVisible,
            isSearchable: field.isSearchable,
            isInherited: field.isInherited,
            defaultValue: field.defaultValue || '',
            validationRules: field.validationRules ? (typeof field.validationRules === 'string' ? field.validationRules : JSON.stringify(field.validationRules, null, 2)) : '',
            sortOrder: field.sortOrder,
            placeholder: field.placeholder || '',
            helpText: field.helpText || '',
            group: field.group || '',
        });
        setFieldFormOpen(true);
        setShowAdvanced(false);
    };

    const cancelFieldForm = () => {
        setFieldFormOpen(false);
        setEditingFieldId(null);
        setFieldForm({ ...emptyField });
    };

    const saveField = async () => {
        if (!fieldForm.name || !fieldForm.label || !fieldForm.slug) {
            showError('Validation', 'Name, Label, and Slug are required.');
            return;
        }
        if (!/^[a-z0-9_]+$/.test(fieldForm.slug)) {
            showError('Validation', 'Slug must be lowercase letters, numbers, and underscores only.');
            return;
        }

        try {
            setFieldSaving(true);
            // Parse validationRules from string to object, strip empty optional strings
            let parsedValidationRules: object | undefined;
            if (fieldForm.validationRules && fieldForm.validationRules.trim()) {
                try {
                    parsedValidationRules = JSON.parse(fieldForm.validationRules);
                } catch {
                    showError('Validation', 'Validation rules must be valid JSON');
                    setFieldSaving(false);
                    return;
                }
            }
            const payload = {
                ...fieldForm,
                workspaceId: workspace?.id,
                validationRules: parsedValidationRules,
                defaultValue: fieldForm.defaultValue || undefined,
                description: fieldForm.description || undefined,
                placeholder: fieldForm.placeholder || undefined,
                helpText: fieldForm.helpText || undefined,
                group: fieldForm.group || undefined,
            };

            if (editingFieldId) {
                const res = await csrfFetch(`/api/admin/fields/${editingFieldId}?workspaceId=${workspace?.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const d = await res.json();
                    throw new Error(d.error || 'Failed to update field');
                }
                const updated = await res.json();
                const updatedField = updated.data || updated;
                setFields(prev => prev.map(f => f.id === editingFieldId ? updatedField : f));
                success('Field updated');
            } else {
                const res = await csrfFetch(`/api/admin/asset-categories/${categoryId}/fields?workspaceId=${workspace?.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const d = await res.json();
                    throw new Error(d.error || 'Failed to create field');
                }
                const created = await res.json();
                const newField = created.data || created;
                setFields(prev => [...prev, newField].sort((a, b) => a.sortOrder - b.sortOrder));
                success('Field created');
            }
            cancelFieldForm();
        } catch (err: unknown) {
            showError('Failed to save field', err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setFieldSaving(false);
        }
    };

    const deleteField = async () => {
        if (!confirmDeleteField) return;
        const { id } = confirmDeleteField;
        setConfirmDeleteField(null);
        try {
            const res = await csrfFetch(`/api/admin/fields/${id}?workspaceId=${workspace?.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete field');
            setFields(prev => prev.filter(f => f.id !== id));
            success('Field deleted');
        } catch (err: unknown) {
            showError('Failed to delete field', err instanceof Error ? err.message : 'An unexpected error occurred');
        }
    };

    const updateFieldForm = (key: string, value: any) => {
        setFieldForm(prev => ({ ...prev, [key]: value }));
    };

    if (fetchingData) return <PageSpinner text="Loading category..." />;
    if (error) return <ErrorState title="Something went wrong" description={error} onRetry={() => window.location.reload()} />;

    return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-12">
            <ConfirmDialog
                open={!!confirmDeleteField}
                title="Delete Field"
                message={`Delete "${confirmDeleteField?.label}"? Existing asset data for this field will be lost.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={deleteField}
                onCancel={() => setConfirmDeleteField(null)}
            />

            {/* Header */}
            <div className="mb-6">
                <Link
                    href="/assets/categories"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                    <ArrowLeft size={14} />
                    Categories
                </Link>
                <h1 className="text-xl font-semibold text-foreground">Edit Category</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Modify classification settings and custom field definitions.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <CSRFToken />

                {/* Section 1: Basic Details */}
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
                            <input {...register('name')} type="text" id="name" className="input w-full" placeholder="e.g., Network Switches" />
                            {errors.name && <p className="mt-1.5 text-xs text-destructive flex items-center gap-1"><Info size={12} /> {errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="icon" className="block text-sm font-medium text-foreground mb-1.5">Icon</label>
                                <div className="relative">
                                    <input {...register('icon')} type="text" id="icon" className="input w-full pl-9" placeholder="e.g., 🖧" maxLength={2} />
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground"><Box size={14} /></div>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">Pick a recognizable emoji.</p>
                            </div>
                            <div>
                                <label htmlFor="sortOrder" className="block text-sm font-medium text-foreground mb-1.5">Sort Order</label>
                                <input {...register('sortOrder', { valueAsNumber: true })} type="number" id="sortOrder" min="0" className="input w-full" />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1.5">
                                Description <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                            </label>
                            <textarea {...register('description')} id="description" rows={3} className="input w-full resize-none" placeholder="Briefly describe the assets in this category..." />
                        </div>
                    </div>
                </div>

                {/* Section 2: Configuration */}
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
                            <select {...register('assetTypeValue')} id="assetTypeValue" className="input w-full sm:w-1/2">
                                <option value="PHYSICAL">Physical Hardware</option>
                                <option value="DIGITAL">Digital / Software Entity</option>
                            </select>
                            <p className="mt-1 text-xs text-muted-foreground">Determines which specialized workflows apply.</p>
                        </div>

                        <div className="pt-3 border-t border-border/60">
                            <label htmlFor="parentId" className="block text-sm font-medium text-foreground mb-1.5">Category Level</label>
                            <select {...register('parentId')} id="parentId" className="input w-full disabled:opacity-50" disabled={fetchingData}>
                                <option value="">Top-Level Category</option>
                                {categories.filter(c => c.allowsChildren).map(cat => (
                                    <option key={cat.id} value={cat.id}>Subcategory of: {cat.name}</option>
                                ))}
                            </select>
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

                {/* Category save bar */}
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
                        <Link href="/assets/categories" className="btn-secondary h-9 text-sm px-4">Cancel</Link>
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

            {/* Section 3: Custom Fields (outside form to avoid nested forms) */}
            <div className="detail-panel mt-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 flex items-center justify-center bg-oracle/10 text-oracle rounded-lg border border-oracle/20">
                            <Layers size={14} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Custom Fields</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">{fields.length} field{fields.length !== 1 ? 's' : ''} defined</p>
                        </div>
                    </div>
                    {!fieldFormOpen && (
                        <button type="button" onClick={openAddField} className="btn-primary h-8 text-xs px-3 inline-flex items-center gap-1.5">
                            <Plus size={12} /> Add Field
                        </button>
                    )}
                </div>

                {/* Fields list */}
                {fields.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {fields.map((field) => (
                            <div
                                key={field.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                    editingFieldId === field.id
                                        ? 'border-primary/30 bg-primary/[0.03]'
                                        : 'border-border/60 bg-surface-1/30 hover:bg-surface-1/60'
                                }`}
                            >
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-2 border border-border text-xs font-mono text-muted-foreground flex-shrink-0">
                                    {field.sortOrder}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-foreground truncate">{field.label}</p>
                                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-cortex/10 text-cortex rounded border border-cortex/20 flex-shrink-0">
                                            {field.fieldType}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <code className="text-[11px] text-muted-foreground/70 font-mono">{field.slug}</code>
                                        {field.isRequired && <span className="text-[10px] font-medium text-destructive">Required</span>}
                                        {field.isUnique && <span className="text-[10px] font-medium text-primary">Unique</span>}
                                        {!field.isVisible && <span className="text-[10px] font-medium text-muted-foreground">Hidden</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => openEditField(field)}
                                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded transition-colors"
                                        aria-label={`Edit ${field.label}`}
                                    >
                                        <Edit2 size={13} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDeleteField({ id: field.id, label: field.label })}
                                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                        aria-label={`Delete ${field.label}`}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {fields.length === 0 && !fieldFormOpen && (
                    <div className="text-center py-10 bg-surface-container-low/30 rounded-xl border border-dashed border-border/50 mb-4">
                        <div className="h-9 w-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center mx-auto mb-2.5">
                            <Plus size={14} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-0.5">No custom fields yet</p>
                        <p className="text-xs text-muted-foreground mb-3">Fields define the custom data tracked on assets in this category.</p>
                        <button type="button" onClick={openAddField} className="btn-primary h-8 text-xs px-3 inline-flex items-center gap-1.5">
                            <Plus size={12} /> Create First Field
                        </button>
                    </div>
                )}

                {/* Inline field form (add / edit) */}
                {fieldFormOpen && (
                    <div className="border border-primary/30 bg-primary/[0.02] rounded-xl p-4 animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-foreground">
                                {editingFieldId ? 'Edit Field' : 'New Field'}
                            </h3>
                            <button type="button" onClick={cancelFieldForm} className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Row 1: Label + Slug */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Label <span className="text-destructive">*</span></label>
                                    <input
                                        type="text"
                                        className="input w-full text-sm"
                                        placeholder="e.g., Hostname"
                                        value={fieldForm.label}
                                        onChange={e => {
                                            const label = e.target.value;
                                            updateFieldForm('label', label);
                                            if (!editingFieldId) {
                                                const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                                                updateFieldForm('name', label.toLowerCase().replace(/\s+/g, '_'));
                                                updateFieldForm('slug', slug);
                                            }
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Slug <span className="text-destructive">*</span></label>
                                    <input
                                        type="text"
                                        className="input w-full text-sm font-mono"
                                        placeholder="e.g., hostname"
                                        value={fieldForm.slug}
                                        onChange={e => updateFieldForm('slug', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    />
                                </div>
                            </div>

                            {/* Row 2: Type + Default + Sort */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Type <span className="text-destructive">*</span></label>
                                    <select
                                        className="input w-full text-sm"
                                        value={fieldForm.fieldType}
                                        onChange={e => updateFieldForm('fieldType', e.target.value)}
                                    >
                                        {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Default Value</label>
                                    <input
                                        type="text"
                                        className="input w-full text-sm"
                                        placeholder={fieldForm.fieldType === 'BOOLEAN' ? 'true / false' : 'Default...'}
                                        value={fieldForm.defaultValue}
                                        onChange={e => updateFieldForm('defaultValue', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Sort Order</label>
                                    <input
                                        type="number"
                                        className="input w-full text-sm"
                                        min="0"
                                        value={fieldForm.sortOrder}
                                        onChange={e => updateFieldForm('sortOrder', parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>

                            {/* Flags row */}
                            <div className="flex flex-wrap gap-x-5 gap-y-2">
                                {([
                                    { key: 'isRequired', label: 'Required' },
                                    { key: 'isUnique', label: 'Unique' },
                                    { key: 'isVisible', label: 'Visible' },
                                    { key: 'isSearchable', label: 'Searchable' },
                                    { key: 'isInherited', label: 'Inherited' },
                                ] as const).map(({ key, label }) => (
                                    <label key={key} className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-foreground">
                                        <input
                                            type="checkbox"
                                            className="h-3.5 w-3.5 rounded border-border accent-primary"
                                            checked={(fieldForm as any)[key]}
                                            onChange={e => updateFieldForm(key, e.target.checked)}
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>

                            {/* Advanced toggle */}
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                            >
                                {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {showAdvanced ? 'Hide' : 'Show'} advanced options
                            </button>

                            {showAdvanced && (
                                <div className="space-y-3 pt-1 animate-fade-in">
                                    <div>
                                        <label className="block text-xs font-medium text-foreground mb-1">Internal Name</label>
                                        <input
                                            type="text"
                                            className="input w-full text-sm"
                                            placeholder="e.g., hostname"
                                            value={fieldForm.name}
                                            onChange={e => updateFieldForm('name', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                                        <textarea
                                            className="input w-full text-sm resize-none"
                                            rows={2}
                                            placeholder="Describe this field..."
                                            value={fieldForm.description}
                                            onChange={e => updateFieldForm('description', e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-foreground mb-1">Placeholder</label>
                                            <input
                                                type="text"
                                                className="input w-full text-sm"
                                                value={fieldForm.placeholder}
                                                onChange={e => updateFieldForm('placeholder', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-foreground mb-1">Group</label>
                                            <input
                                                type="text"
                                                className="input w-full text-sm"
                                                placeholder="e.g., Network Config"
                                                value={fieldForm.group}
                                                onChange={e => updateFieldForm('group', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-foreground mb-1">Help Text</label>
                                        <input
                                            type="text"
                                            className="input w-full text-sm"
                                            value={fieldForm.helpText}
                                            onChange={e => updateFieldForm('helpText', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-foreground mb-1">Validation Rules (JSON)</label>
                                        <textarea
                                            className="input w-full text-sm font-mono resize-none"
                                            rows={2}
                                            placeholder='{"min": 0, "max": 100}'
                                            value={fieldForm.validationRules}
                                            onChange={e => updateFieldForm('validationRules', e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Save / Cancel */}
                            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                                <button type="button" onClick={cancelFieldForm} className="btn-secondary h-8 text-xs px-3">Cancel</button>
                                <button
                                    type="button"
                                    onClick={saveField}
                                    disabled={fieldSaving}
                                    className="btn-primary h-8 text-xs px-3 inline-flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {fieldSaving ? (
                                        <><div className="animate-spin rounded-full h-3 w-3 border-2 border-primary-foreground border-t-transparent" /> Saving…</>
                                    ) : (
                                        <><Check size={12} /> {editingFieldId ? 'Update Field' : 'Add Field'}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
