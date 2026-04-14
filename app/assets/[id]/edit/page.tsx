'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { PageSpinner } from '@/components/ui/Spinner';
import { useToast } from '@/lib/toast';

import { useWorkspace } from '@/lib/workspace/context';

interface FieldDefinition {
    id: string;
    name: string;
    label: string;
    fieldType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'JSON';
    required: boolean;
    defaultValue?: string;
}

interface AssetCategory {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    parentId: string | null;
    assetTypeValue: 'PHYSICAL' | 'DIGITAL' | 'DYNAMIC';
    isActive: boolean;
    fieldDefinitions: FieldDefinition[];
}

export default function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
    const { workspace } = useWorkspace();
    const router = useRouter();
    const { success, error: toastError } = useToast();

    const [id, setId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Engine State
    const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);
    const [selectedParentCategory, setSelectedParentCategory] = useState<AssetCategory | null>(null);
    const [selectedChildCategory, setSelectedChildCategory] = useState<AssetCategory | null>(null);
    const [categoriesList, setCategoriesList] = useState<AssetCategory[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        categoryId: '',
        status: 'AVAILABLE',
        assetType: 'DYNAMIC' as 'PHYSICAL' | 'DIGITAL' | 'DYNAMIC',
    });

    const [customFields, setCustomFields] = useState<Record<string, any>>({});
    const [physicalAsset, setPhysicalAsset] = useState<Record<string, any>>({});
    const [digitalAsset, setDigitalAsset] = useState<Record<string, any>>({});

    // Unwrap params and fetch asset data
    useEffect(() => {
        if (!workspace?.id) return;
        params.then(({ id: assetId }) => {
            setId(assetId);
            fetchAsset(assetId, workspace.id);
        });
    }, [params, workspace?.id]);

    const fetchAsset = async (assetId: string, workspaceId: string) => {
        try {
            // 1. Fetch Engine Schemas just in case they change the Class type
            let fetchedCategories: AssetCategory[] = [];
            const catRes = await csrfFetch(`/api/assets/categories?workspaceId=${workspaceId}`);
            if (catRes.ok) {
                const catData = await catRes.json();
                fetchedCategories = catData.data || [];
                setCategoriesList(fetchedCategories);
            }

            // 2. Fetch the specific Node
            const response = await csrfFetch(`/api/assets/${assetId}`);
            if (!response.ok) throw new Error('Failed to load asset');

            const result = await response.json();
            const asset = result.data || result; // Backend inconsistency guard

            if (asset.category) {
                const assignedCategory = fetchedCategories.find((c: any) => c.id === asset.categoryId) || asset.category;
                if (assignedCategory.parentId) {
                    const parent = fetchedCategories.find((c: any) => c.id === assignedCategory.parentId) || null;
                    setSelectedParentCategory(parent);
                    setSelectedChildCategory(assignedCategory);
                    setSelectedCategory(assignedCategory);
                } else {
                    setSelectedParentCategory(assignedCategory);
                    setSelectedCategory(assignedCategory);
                }
            }

            // 3. Pre-fill core form
            setFormData({
                name: asset.name || '',
                categoryId: asset.categoryId || '',
                status: asset.status || 'AVAILABLE',
                assetType: asset.assetType || 'DYNAMIC',
            });

            if (asset.physicalAsset) {
                setPhysicalAsset({
                    category: asset.physicalAsset.category,
                    processor: asset.physicalAsset.processor,
                    ram: asset.physicalAsset.ram,
                    storage: asset.physicalAsset.storage,
                    osVersion: asset.physicalAsset.osVersion,
                    macAddress: asset.physicalAsset.macAddress,
                    ipAddress: asset.physicalAsset.ipAddress,
                });
            }
            if (asset.digitalAsset) {
                setDigitalAsset({
                    category: asset.digitalAsset.category,
                    vendor: asset.digitalAsset.vendor,
                    licenseKey: asset.digitalAsset.licenseKey,
                    licenseType: asset.digitalAsset.licenseType,
                    seatCount: asset.digitalAsset.seatCount,
                    subscriptionTier: asset.digitalAsset.subscriptionTier,
                    monthlyRecurringCost: asset.digitalAsset.monthlyRecurringCost,
                    renewalDate: asset.digitalAsset.renewalDate ? new Date(asset.digitalAsset.renewalDate).toISOString().split('T')[0] : '',
                });
            }

            // 4. Pre-fill Custom Mapping Data
            const existingCustomState: Record<string, any> = {};

            // Gather all field definitions from the full category chain
            const assignedCat = fetchedCategories.find((c: any) => c.id === asset.categoryId);
            const allDefs: FieldDefinition[] = [];
            if (assignedCat) {
                if (assignedCat.parentId) {
                    const parentCat = fetchedCategories.find((c: any) => c.id === assignedCat.parentId);
                    if (parentCat) allDefs.push(...(parentCat.fieldDefinitions || []));
                }
                allDefs.push(...(assignedCat.fieldDefinitions || []));
                if (!assignedCat.parentId) {
                    fetchedCategories
                        .filter((c: any) => c.parentId === assignedCat.id && c.isActive)
                        .forEach((child: any) => allDefs.push(...(child.fieldDefinitions || [])));
                }
            }

            allDefs.forEach((def: FieldDefinition) => {
                const record = (asset.fieldValues || []).find((fv: any) => fv.fieldDefinitionId === def.id);
                if (record) {
                    if (def.fieldType === 'BOOLEAN') existingCustomState[def.name] = record.value === 'true';
                    else existingCustomState[def.name] = record.value;
                } else {
                    existingCustomState[def.name] = def.fieldType === 'BOOLEAN' ? false : '';
                }
            });
            setCustomFields(existingCustomState);
            setLoading(false);

        } catch (err: any) {
            toastError('Failed to load Editor', err.message);
            setLoading(false);
        }
    };

    // Build grouped field definitions: parent fields + selected category fields
    const getGroupedFields = (category: AssetCategory): { categoryName: string; icon: string; fields: FieldDefinition[] }[] => {
        const groups: { categoryName: string; icon: string; fields: FieldDefinition[] }[] = [];
        if (category.parentId) {
            const parent = categoriesList.find(c => c.id === category.parentId);
            if (parent && (parent.fieldDefinitions || []).length > 0) {
                groups.push({ categoryName: parent.name, icon: parent.icon, fields: parent.fieldDefinitions });
            }
        }
        if ((category.fieldDefinitions || []).length > 0) {
            groups.push({ categoryName: category.name, icon: category.icon, fields: category.fieldDefinitions });
        }
        if (!category.parentId) {
            categoriesList
                .filter(c => c.parentId === category.id && c.isActive && (c.fieldDefinitions || []).length > 0)
                .forEach(child => {
                    groups.push({ categoryName: child.name, icon: child.icon, fields: child.fieldDefinitions });
                });
        }
        return groups;
    };

    const getAllFieldDefinitions = (category: AssetCategory): FieldDefinition[] => {
        return getGroupedFields(category).flatMap(g => g.fields);
    };

    const applyCategory = (category: AssetCategory | null) => {
        setSelectedCategory(category);
        if (category) {
            setFormData(prev => ({ ...prev, categoryId: category.id }));
            const initialCustom: Record<string, any> = {};
            getAllFieldDefinitions(category).forEach((def: FieldDefinition) => {
                initialCustom[def.name] = def.defaultValue || '';
                if (def.fieldType === 'BOOLEAN') initialCustom[def.name] = def.defaultValue === 'true';
            });
            setCustomFields(initialCustom);
        } else {
            setFormData(prev => ({ ...prev, categoryId: '' }));
            setCustomFields({});
        }
    };

    const handleParentCategorySelect = (categoryId: string) => {
        const parent = categoriesList.find(c => c.id === categoryId) || null;
        setSelectedParentCategory(parent);
        setSelectedChildCategory(null);
        applyCategory(parent);
    };

    const handleChildCategorySelect = (categoryId: string) => {
        const child = categoriesList.find(c => c.id === categoryId) || null;
        setSelectedChildCategory(child);
        applyCategory(child);
    };

    const handleCustomFieldChange = (fieldName: string, value: any) => {
        setCustomFields(prev => ({
            ...prev,
            [fieldName]: value
        }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const payload: any = {
                ...formData,
                customFields: customFields
            };

            if (formData.assetType === 'PHYSICAL') {
                payload.physicalAsset = {
                    category: physicalAsset.category || 'OTHER',
                    processor: physicalAsset.processor,
                    ram: physicalAsset.ram ? parseInt(physicalAsset.ram) : undefined,
                    storage: physicalAsset.storage ? parseInt(physicalAsset.storage) : undefined,
                    osVersion: physicalAsset.osVersion,
                    macAddress: physicalAsset.macAddress,
                    ipAddress: physicalAsset.ipAddress,
                }
            } else if (formData.assetType === 'DIGITAL') {
                payload.digitalAsset = {
                    category: digitalAsset.category || 'OTHER',
                    vendor: digitalAsset.vendor,
                    licenseKey: digitalAsset.licenseKey,
                    licenseType: digitalAsset.licenseType || 'PERPETUAL',
                    seatCount: digitalAsset.seatCount ? parseInt(digitalAsset.seatCount) : undefined,
                    subscriptionTier: digitalAsset.subscriptionTier,
                    monthlyRecurringCost: digitalAsset.monthlyRecurringCost ? parseFloat(digitalAsset.monthlyRecurringCost) : undefined,
                    renewalDate: digitalAsset.renewalDate ? new Date(digitalAsset.renewalDate).toISOString() : undefined,
                }
            }

            const response = await csrfFetch(`/api/assets/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update asset node');
            }

            success('Changes Saved', 'Asset parameters updated successfully.');
            router.push(`/assets/${id}`);
            router.refresh(); // Forcing a server cache reload downstream

        } catch (err: any) {
            toastError('Update Failed', err.message);
            setSubmitting(false);
        }
    };

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (loading) return <PageSpinner text="Booting Dynamic Editor..." />;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <Link href={`/assets/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </Link>
            </div>
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-foreground">Edit Parameters</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Configure asset node details and custom tracking variables.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* 1. Core Platform Configuration */}
                <div className="detail-panel">
                    <h2 className="detail-panel-title">1. Core Configuration</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-foreground mb-1.5">Asset Name *</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                className="input w-full"
                                placeholder="Device name..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Node Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => updateField('status', e.target.value)}
                                className="input w-full"
                            >
                                <option value="AVAILABLE">✅ Available</option>
                                <option value="ASSIGNED">👤 Assigned</option>
                                <option value="MAINTENANCE">🔧 In Maintenance</option>
                                <option value="RETIRED">🛑 Retired</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-primary mb-2">Base Category *</label>
                            {(() => {
                                const parentCats = categoriesList.filter(
                                    c => !c.parentId && c.isActive && c.assetTypeValue === formData.assetType
                                );
                                const childCats = selectedParentCategory
                                    ? categoriesList.filter(c => c.parentId === selectedParentCategory.id && c.isActive)
                                    : [];
                                return (
                                    <div className="space-y-3">
                                        <select
                                            required
                                            className="input w-full border-nerve/50 focus:border-primary"
                                            value={selectedParentCategory?.id || ''}
                                            onChange={e => handleParentCategorySelect(e.target.value)}
                                        >
                                            <option value="" disabled>
                                                {formData.assetType === 'PHYSICAL' ? '🖥️ Select Hardware category…'
                                                    : formData.assetType === 'DIGITAL' ? '💿 Select Software category…'
                                                    : 'Select category…'}
                                            </option>
                                            {parentCats.map(cat => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.icon} {cat.name}
                                                </option>
                                            ))}
                                        </select>

                                        {childCats.length > 0 && (
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                                                    {selectedParentCategory?.icon} {selectedParentCategory?.name} — Sub-category *
                                                </label>
                                                <select
                                                    required
                                                    className="input w-full"
                                                    value={selectedChildCategory?.id || ''}
                                                    onChange={e => handleChildCategorySelect(e.target.value)}
                                                >
                                                    <option value="" disabled>Select sub-category…</option>
                                                    {childCats.map(child => (
                                                        <option key={child.id} value={child.id}>
                                                            {child.icon} {child.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            <p className="text-xs text-muted-foreground mt-2">Warning: Changing the category will reset all custom matrix tracking variables.</p>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-foreground mb-1.5">Asset Type Track *</label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    disabled
                                    className={`p-3.5 border rounded-xl text-center transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${formData.assetType === 'PHYSICAL' ? 'border-primary bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground bg-surface-2'}`}
                                >
                                    <div className="text-sm font-semibold mb-0.5">Physical</div>
                                    <div className="text-xs opacity-70">Laptops, Servers, Network</div>
                                </button>
                                <button
                                    type="button"
                                    disabled
                                    className={`p-3.5 border rounded-xl text-center transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${formData.assetType === 'DIGITAL' ? 'border-primary bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground bg-surface-2'}`}
                                >
                                    <div className="text-sm font-semibold mb-0.5">Digital</div>
                                    <div className="text-xs opacity-70">SaaS, Licenses, Domains</div>
                                </button>
                                <button
                                    type="button"
                                    disabled
                                    className={`p-3.5 border rounded-xl text-center transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${formData.assetType === 'DYNAMIC' ? 'border-primary bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground bg-surface-2'}`}
                                >
                                    <div className="text-sm font-semibold mb-0.5">Custom</div>
                                    <div className="text-xs opacity-70">Dynamic matrix</div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step 1.5: Hardware / Software Specifics */}
                {formData.assetType === 'PHYSICAL' && (
                    <div className="detail-panel">
                        <h2 className="detail-panel-title">Hardware Specifications</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">MAC Address</label>
                                <input type="text" className="input w-full" placeholder="00:00:00:00:00:00" value={physicalAsset.macAddress || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, macAddress: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">IP Address / Host</label>
                                <input type="text" className="input w-full" placeholder="192.168.1.100" value={physicalAsset.ipAddress || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, ipAddress: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">OS Version</label>
                                <select className="input w-full" value={physicalAsset.osVersion || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, osVersion: e.target.value })}>
                                    <option value="" disabled>Select OS…</option>
                                    <optgroup label="Windows">
                                        <option value="Windows 11">Windows 11</option>
                                        <option value="Windows 10">Windows 10</option>
                                        <option value="Windows Server 2022">Windows Server 2022</option>
                                        <option value="Windows Server 2019">Windows Server 2019</option>
                                    </optgroup>
                                    <optgroup label="Apple">
                                        <option value="macOS Sequoia">macOS Sequoia</option>
                                        <option value="macOS Sonoma">macOS Sonoma</option>
                                        <option value="macOS Ventura">macOS Ventura</option>
                                        <option value="iOS">iOS</option>
                                        <option value="iPadOS">iPadOS</option>
                                    </optgroup>
                                    <optgroup label="Linux">
                                        <option value="Ubuntu Linux">Ubuntu Linux</option>
                                        <option value="Debian Linux">Debian Linux</option>
                                        <option value="Red Hat Enterprise Linux">Red Hat Enterprise Linux</option>
                                        <option value="Rocky / AlmaLinux">Rocky / AlmaLinux</option>
                                    </optgroup>
                                    <optgroup label="Other">
                                        <option value="Android">Android</option>
                                        <option value="ChromeOS">ChromeOS</option>
                                        <option value="Other">Other</option>
                                    </optgroup>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">RAM (GB)</label>
                                <input type="number" className="input w-full" placeholder="16" value={physicalAsset.ram || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, ram: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Storage (GB)</label>
                                <input type="number" className="input w-full" placeholder="512" value={physicalAsset.storage || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, storage: e.target.value })} />
                            </div>
                        </div>
                    </div>
                )}

                {formData.assetType === 'DIGITAL' && (
                    <div className="detail-panel">
                        <h2 className="detail-panel-title">Software &amp; License Metrics</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Software Category</label>
                                <select className="input w-full" value={digitalAsset.category || 'SAAS_SUBSCRIPTION'} onChange={e => setDigitalAsset({ ...digitalAsset, category: e.target.value })}>
                                    <option value="SAAS_SUBSCRIPTION">SaaS Subscription</option>
                                    <option value="LICENSE">License Key</option>
                                    <option value="API_SERVICE">API Service / Cloud</option>
                                    <option value="WEB_APPLICATION">Web App Domain</option>
                                    <option value="OTHER">Other Digital Space</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Vendor / Provider</label>
                                <input type="text" className="input w-full" placeholder="e.g. Microsoft, AWS" value={digitalAsset.vendor || ''} onChange={e => setDigitalAsset({ ...digitalAsset, vendor: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">License Type</label>
                                <select className="input w-full" value={digitalAsset.licenseType || 'SUBSCRIPTION'} onChange={e => setDigitalAsset({ ...digitalAsset, licenseType: e.target.value })}>
                                    <option value="SUBSCRIPTION">Recurring Subscription</option>
                                    <option value="PERPETUAL">Perpetual (One-time)</option>
                                    <option value="OPEN_SOURCE">Open Source</option>
                                    <option value="ENTERPRISE">Enterprise Agreement</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Seat Count / Licenses</label>
                                <input type="number" className="input w-full" placeholder="50" value={digitalAsset.seatCount || ''} onChange={e => setDigitalAsset({ ...digitalAsset, seatCount: e.target.value })} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-foreground mb-1.5">License Key / Access Token</label>
                                <input type="text" className="input w-full font-mono text-xs" placeholder="XXXX-XXXX-XXXX-XXXX" value={digitalAsset.licenseKey || ''} onChange={e => setDigitalAsset({ ...digitalAsset, licenseKey: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Monthly Cost</label>
                                <input type="number" step="0.01" className="input w-full" placeholder="0.00" value={digitalAsset.monthlyRecurringCost || ''} onChange={e => setDigitalAsset({ ...digitalAsset, monthlyRecurringCost: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Renewal Date</label>
                                <input type="date" className="input w-full" value={digitalAsset.renewalDate || ''} onChange={e => setDigitalAsset({ ...digitalAsset, renewalDate: e.target.value })} />
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Dynamic Schema UI */}
                {selectedCategory && (() => {
                    const grouped = getGroupedFields(selectedCategory);
                    const totalFields = grouped.reduce((sum, g) => sum + g.fields.length, 0);
                    return (
                    <div className="detail-panel border-primary/20">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
                            <h2 className="text-sm font-semibold text-foreground">2. Custom Matrix Data</h2>
                            <span className="badge text-[11px] px-2.5 py-1 bg-primary/10 text-primary rounded-lg">{selectedCategory.icon} {selectedCategory.name}</span>
                        </div>

                        {totalFields === 0 ? (
                            <p className="text-sm text-muted-foreground/70 italic">No custom tracking fields required for this Class.</p>
                        ) : (
                            <div className="space-y-6">
                                {grouped.map((group, gi) => (
                                    <div key={gi}>
                                        {grouped.length > 1 && (
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-base">{group.icon}</span>
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.categoryName} Fields</span>
                                                <div className="flex-1 h-px bg-border/40"></div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {group.fields.map((def) => (
                                                <div key={def.id} className={def.fieldType === 'JSON' ? 'md:col-span-2' : ''}>
                                                    <label className="block text-sm font-medium text-foreground mb-1.5">
                                                        {def.label} {def.required && <span className="text-destructive">*</span>}
                                                    </label>

                                                    {def.fieldType === 'BOOLEAN' ? (
                                                        <div className="flex items-center gap-2.5 mt-2">
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 rounded border-border accent-primary"
                                                                checked={customFields[def.name] === true || customFields[def.name] === 'true'}
                                                                onChange={e => handleCustomFieldChange(def.name, e.target.checked)}
                                                            />
                                                            <span className="text-sm text-muted-foreground">Enable</span>
                                                        </div>
                                                    ) : def.fieldType === 'DATE' ? (
                                                        <input
                                                            type="date"
                                                            required={def.required}
                                                            className="input w-full"
                                                            value={customFields[def.name] || ''}
                                                            onChange={e => handleCustomFieldChange(def.name, e.target.value)}
                                                        />
                                                    ) : def.fieldType === 'JSON' ? (
                                                        <textarea
                                                            required={def.required}
                                                            className="input w-full h-32 font-mono text-xs"
                                                            placeholder='{"key": "value"}'
                                                            value={customFields[def.name] || ''}
                                                            onChange={e => handleCustomFieldChange(def.name, e.target.value)}
                                                        />
                                                    ) : (
                                                        <input
                                                            type={def.fieldType === 'NUMBER' ? 'number' : 'text'}
                                                            required={def.required}
                                                            className="input w-full"
                                                            placeholder={`Enter ${def.label}...`}
                                                            value={customFields[def.name] || ''}
                                                            onChange={e => handleCustomFieldChange(def.name, e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    );
                })()}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                    <Link href={`/assets/${id}`} className="btn-secondary h-9 text-sm px-4">
                        Discard
                    </Link>
                    <button
                        type="submit"
                        disabled={!selectedCategory || submitting}
                        className="btn-primary h-9 text-sm px-4 inline-flex items-center gap-2"
                    >
                        {submitting
                            ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent" /> Saving…</>
                            : 'Save Parameters'}
                    </button>
                </div>
            </form>
        </div>
    );
}
    