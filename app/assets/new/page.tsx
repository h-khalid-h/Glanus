'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { useWorkspace } from '@/lib/workspace/context';
import { PageSpinner } from '@/components/ui/Spinner';

interface FieldDefinition {
    id: string;
    name: string;
    label: string;
    fieldType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'JSON';
    required: boolean;
    defaultValue?: string;
    options?: any;
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

export default function DynamicAssetCreatePage() {
    const router = useRouter();
    const { workspace } = useWorkspace();
    const { success, error: toastError } = useToast();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [categories, setCategories] = useState<AssetCategory[]>([]);
    const [selectedParentCategory, setSelectedParentCategory] = useState<AssetCategory | null>(null);
    const [selectedChildCategory, setSelectedChildCategory] = useState<AssetCategory | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);

    // Form State
    const [assetName, setAssetName] = useState('');
    const [assetStatus, setAssetStatus] = useState('AVAILABLE');
    const [assetType, setAssetType] = useState<'PHYSICAL' | 'DIGITAL' | 'DYNAMIC'>('PHYSICAL');
    const [customFields, setCustomFields] = useState<Record<string, any>>({});

    // Reset category selections whenever asset type changes
    useEffect(() => {
        setSelectedParentCategory(null);
        setSelectedChildCategory(null);
        setSelectedCategory(null);
        setCustomFields({});
    }, [assetType]);

    // Dedicated state for Physical/Digital payload
    const [physicalAsset, setPhysicalAsset] = useState<Record<string, any>>({});
    const [digitalAsset, setDigitalAsset] = useState<Record<string, any>>({});

    useEffect(() => {
        const fetchCategories = async () => {
            if (!workspace?.id) return;
            try {
                const res = await csrfFetch(`/api/assets/categories?workspaceId=${workspace.id}`);
                if (!res.ok) throw new Error('Failed to load classes');
                const data = await res.json();
                setCategories(data.data || []);
            } catch (_err) {
                toastError('Error Loading Schemas', 'Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
        fetchCategories();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [workspace?.id]);

        const applyCategory = (category: AssetCategory | null) => {
            setSelectedCategory(category);
        const initialCustom: Record<string, any> = {};
        if (category) {
            // Collect fields from the full category chain (parent → child)
            getAllFieldDefinitions(category).forEach(def => {
                initialCustom[def.name] = def.defaultValue || '';
                if (def.fieldType === 'BOOLEAN') initialCustom[def.name] = def.defaultValue === 'true';
            });
        }
        setCustomFields(initialCustom);
    };

    // Build grouped field definitions: parent fields + selected category fields
    const getGroupedFields = (category: AssetCategory): { categoryName: string; icon: string; fields: FieldDefinition[] }[] => {
        const groups: { categoryName: string; icon: string; fields: FieldDefinition[] }[] = [];
        // If this is a child, include parent fields first
        if (category.parentId) {
            const parent = categories.find(c => c.id === category.parentId);
            if (parent && (parent.fieldDefinitions || []).length > 0) {
                groups.push({ categoryName: parent.name, icon: parent.icon, fields: parent.fieldDefinitions });
            }
        }
        // Add this category's own fields
        if ((category.fieldDefinitions || []).length > 0) {
            groups.push({ categoryName: category.name, icon: category.icon, fields: category.fieldDefinitions });
        }
        // If this is a parent, include active children's fields
        if (!category.parentId) {
            categories
                .filter(c => c.parentId === category.id && c.isActive && (c.fieldDefinitions || []).length > 0)
                .forEach(child => {
                    groups.push({ categoryName: child.name, icon: child.icon, fields: child.fieldDefinitions });
                });
        }
        return groups;
    };

    // Flat list of all field definitions for form state initialization
    const getAllFieldDefinitions = (category: AssetCategory): FieldDefinition[] => {
        return getGroupedFields(category).flatMap(g => g.fields);
    };

    const handleParentCategorySelect = (categoryId: string) => {
        const parent = categories.find(c => c.id === categoryId) || null;
        setSelectedParentCategory(parent);
        setSelectedChildCategory(null);
        // Always apply the parent so Custom Matrix Data shows immediately
        applyCategory(parent);
    };

    const handleChildCategorySelect = (categoryId: string) => {
        const child = categories.find(c => c.id === categoryId) || null;
        setSelectedChildCategory(child);
        applyCategory(child);
    };

    const handleCustomFieldChange = (fieldName: string, value: any) => {
        setCustomFields(prev => ({
            ...prev,
            [fieldName]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCategory || !workspace?.id) return;

        setSubmitting(true);
        try {
            // Package for backend
            const payload: any = {
                workspaceId: workspace.id,
                name: assetName,
                categoryId: selectedCategory.id,
                status: assetStatus,
                assetType: assetType,
                customFields: customFields
            };

            if (assetType === 'PHYSICAL') {
                payload.physicalAsset = {
                    category: 'OTHER',
                    processor: physicalAsset.processor,
                    ram: physicalAsset.ram ? parseInt(physicalAsset.ram) : undefined,
                    storage: physicalAsset.storage ? parseInt(physicalAsset.storage) : undefined,
                    osVersion: physicalAsset.osVersion,
                    macAddress: physicalAsset.macAddress,
                    ipAddress: physicalAsset.ipAddress,
                }
            } else if (assetType === 'DIGITAL') {
                payload.digitalAsset = {
                    category: 'OTHER',
                    vendor: digitalAsset.vendor,
                    licenseKey: digitalAsset.licenseKey,
                    licenseType: digitalAsset.licenseType || 'PERPETUAL',
                    seatCount: digitalAsset.seatCount ? parseInt(digitalAsset.seatCount) : undefined,
                    subscriptionTier: digitalAsset.subscriptionTier,
                    monthlyRecurringCost: digitalAsset.monthlyRecurringCost ? parseFloat(digitalAsset.monthlyRecurringCost) : undefined,
                    renewalDate: digitalAsset.renewalDate ? new Date(digitalAsset.renewalDate).toISOString() : undefined,
                }
            }

            const response = await csrfFetch('/api/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || data.error || 'Failed to create asset');
            }

            const newAsset = await response.json();
            success('Asset Created', `${assetName} has been successfully provisioned.`);
            router.push(`/assets/${newAsset.data?.id || newAsset.id}`);

        } catch (err: unknown) {
            toastError('Creation Failed', err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <PageSpinner text="Loading Engine Definitions..." />;

    // Reusable input styling pattern
    const inputClasses = "w-full bg-surface-container-low border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary transition-all py-2.5 px-3 text-on-surface text-sm outline-none placeholder:text-muted-foreground";
    const labelClasses = "block text-sm font-medium text-muted-foreground mb-1.5";
    const panelClasses = "bg-surface-container rounded-xl shadow-sm border border-border/40 p-6";

    return (
        <div className="max-w-4xl mx-auto animate-fade-in pb-12">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Link href="/assets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-2 font-medium">
                        <ArrowLeft size={14} />
                        Back to Assets
                    </Link>
                    <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Provision New Asset</h1>
                    <p className="text-sm text-muted-foreground mt-1">Register and configure a tracked resource within this environment.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Step 1: Core Configuration */}
                    <div className={panelClasses}>
                        <div className="flex items-center gap-2 mb-6 border-b border-border/60 pb-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">1</span>
                            <h2 className="text-base font-semibold text-on-surface">Core Configuration</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClasses}>Asset Name *</label>
                                <input
                                    type="text"
                                    required
                                    className={inputClasses}
                                    placeholder="e.g. Primary Edge Router"
                                    value={assetName}
                                    onChange={e => setAssetName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className={labelClasses}>Initial Status *</label>
                                <select
                                    required
                                    className={inputClasses}
                                    value={assetStatus}
                                    onChange={e => setAssetStatus(e.target.value)}
                                >
                                    <option value="AVAILABLE">Available</option>
                                    <option value="ASSIGNED">Assigned</option>
                                    <option value="MAINTENANCE">Maintenance</option>
                                </select>
                            </div>

                            <div className="md:col-span-2 mt-2">
                                <label className={labelClasses}>Asset Tracking Type *</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <button
                                        type="button"
                                        className={`p-4 border rounded-xl text-left transition-all duration-200 ${assetType === 'PHYSICAL' ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border bg-surface-container-low hover:border-muted'}`}
                                        onClick={() => setAssetType('PHYSICAL')}
                                    >
                                        <div className={`text-sm font-semibold mb-1 ${assetType === 'PHYSICAL' ? 'text-primary' : 'text-on-surface'}`}>Physical Hardware</div>
                                        <div className="text-xs text-muted-foreground">Laptops, Servers, Network gear</div>
                                    </button>
                                    <button
                                        type="button"
                                        className={`p-4 border rounded-xl text-left transition-all duration-200 ${assetType === 'DIGITAL' ? 'border-oracle bg-oracle/10 ring-1 ring-oracle/30' : 'border-border bg-surface-container-low hover:border-muted'}`}
                                        onClick={() => setAssetType('DIGITAL')}
                                    >
                                        <div className={`text-sm font-semibold mb-1 ${assetType === 'DIGITAL' ? 'text-oracle' : 'text-on-surface'}`}>Digital Subscription</div>
                                        <div className="text-xs text-muted-foreground">SaaS, Cloud Software, Licenses</div>
                                    </button>
                                    <button
                                        type="button"
                                        className={`p-4 border rounded-xl text-left transition-all duration-200 ${assetType === 'DYNAMIC' ? 'border-cortex bg-cortex/10 ring-1 ring-cortex/30' : 'border-border bg-surface-container-low hover:border-muted'}`}
                                        onClick={() => setAssetType('DYNAMIC')}
                                    >
                                        <div className={`text-sm font-semibold mb-1 ${assetType === 'DYNAMIC' ? 'text-cortex' : 'text-on-surface'}`}>Custom Schema</div>
                                        <div className="text-xs text-muted-foreground">Freeform dynamic matrix assets</div>
                                    </button>
                                </div>
                            </div>

                            <div className="md:col-span-2 pt-2">
                                <label className="block text-sm font-medium text-on-surface mb-2">Base Category Selection *</label>
                                {(() => {
                                    const parentCats = categories.filter(
                                        c => !c.parentId && c.isActive && c.assetTypeValue === assetType
                                    );
                                    const childCats = selectedParentCategory
                                        ? categories.filter(c => c.parentId === selectedParentCategory.id && c.isActive)
                                        : [];
                                    return (
                                        <div className="space-y-4 p-4 rounded-xl border border-border bg-surface-container-low/50">
                                            <div>
                                                <select
                                                    required
                                                    className={inputClasses}
                                                    value={selectedParentCategory?.id || ''}
                                                    onChange={e => handleParentCategorySelect(e.target.value)}
                                                >
                                                    <option value="" disabled>
                                                        {assetType === 'PHYSICAL' ? '🖥️ Select Hardware Category…'
                                                            : assetType === 'DIGITAL' ? '💿 Select Software Category…'
                                                            : 'Select Base Category…'}
                                                    </option>
                                                    {parentCats.map(cat => (
                                                        <option key={cat.id} value={cat.id}>
                                                            {cat.icon} {cat.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {childCats.length > 0 && (
                                                <div className="animate-fade-in">
                                                    <div className="flex items-center gap-2 mb-2 ml-1">
                                                        <div className="w-4 h-4 border-l-2 border-b-2 border-border rounded-bl-sm"></div>
                                                        <label className="block text-xs font-medium text-muted-foreground">
                                                            Select Sub-category for {selectedParentCategory?.name} *
                                                        </label>
                                                    </div>
                                                    <select
                                                        required
                                                        className={inputClasses}
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
                                <p className="text-xs text-muted-foreground mt-2.5 ml-1 flex items-center gap-1.5">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted"></span> 
                                    Category selection dictates the custom technical properties applicable below.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 1.5: Hardware / Software Specifics */}
                    {assetType === 'PHYSICAL' && (
                        <div className={`${panelClasses} border-primary/20 bg-primary/[0.02]`}>
                            <div className="flex items-center gap-2 mb-6 border-b border-border/60 pb-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">A</span>
                                <h2 className="text-base font-semibold text-on-surface">Hardware Specifications</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className={labelClasses}>MAC Address</label>
                                    <input type="text" className={`${inputClasses} font-mono`} placeholder="00:00:00:00:00:00" value={physicalAsset.macAddress || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, macAddress: e.target.value })} />
                                </div>
                                <div>
                                    <label className={labelClasses}>IP Address / Hostname</label>
                                    <input type="text" className={`${inputClasses} font-mono`} placeholder="192.168.1.100" value={physicalAsset.ipAddress || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, ipAddress: e.target.value })} />
                                </div>
                                <div>
                                    <label className={labelClasses}>OS Version</label>
                                    <select className={inputClasses} value={physicalAsset.osVersion || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, osVersion: e.target.value })}>
                                        <option value="" disabled>Select OS Environment…</option>
                                        <optgroup label="Windows">
                                            <option value="Windows 11">Windows 11</option>
                                            <option value="Windows 10">Windows 10</option>
                                            <option value="Windows Server 2022">Windows Server 2022</option>
                                        </optgroup>
                                        <optgroup label="Apple">
                                            <option value="macOS Sequoia">macOS Sequoia</option>
                                            <option value="macOS Sonoma">macOS Sonoma</option>
                                            <option value="iOS / iPadOS">iOS / iPadOS</option>
                                        </optgroup>
                                        <optgroup label="Linux">
                                            <option value="Ubuntu Linux">Ubuntu Linux</option>
                                            <option value="Debian Linux">Debian Linux</option>
                                            <option value="RHEL / Rocky Linux">RHEL / Rocky Linux</option>
                                        </optgroup>
                                        <optgroup label="Other">
                                            <option value="Android">Android</option>
                                            <option value="ChromeOS">ChromeOS</option>
                                            <option value="Other">Other Firmware</option>
                                        </optgroup>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClasses}>RAM (GB)</label>
                                        <input type="number" className={inputClasses} placeholder="16" value={physicalAsset.ram || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, ram: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={labelClasses}>Storage (GB)</label>
                                        <input type="number" className={inputClasses} placeholder="512" value={physicalAsset.storage || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, storage: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {assetType === 'DIGITAL' && (
                        <div className={`${panelClasses} border-oracle/20 bg-oracle/[0.02]`}>
                            <div className="flex items-center gap-2 mb-6 border-b border-border/60 pb-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-oracle/20 text-oracle text-xs font-bold">A</span>
                                <h2 className="text-base font-semibold text-on-surface">Software &amp; Access Metrics</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className={labelClasses}>Vendor / Provider</label>
                                    <input type="text" className={inputClasses} placeholder="e.g. Microsoft, AWS" value={digitalAsset.vendor || ''} onChange={e => setDigitalAsset({ ...digitalAsset, vendor: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className={labelClasses}>License Type</label>
                                        <select className={inputClasses} value={digitalAsset.licenseType || 'SUBSCRIPTION'} onChange={e => setDigitalAsset({ ...digitalAsset, licenseType: e.target.value })}>
                                            <option value="SUBSCRIPTION">Recurring Subscription</option>
                                            <option value="PERPETUAL">Perpetual</option>
                                            <option value="ENTERPRISE">Enterprise Agreement</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className={labelClasses}>Seat Count</label>
                                        <input type="number" className={inputClasses} placeholder="50" value={digitalAsset.seatCount || ''} onChange={e => setDigitalAsset({ ...digitalAsset, seatCount: e.target.value })} />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelClasses}>License Key / Access Token</label>
                                    <input type="text" className={`${inputClasses} font-mono tracking-wider`} placeholder="XXXX-XXXX-XXXX-XXXX" value={digitalAsset.licenseKey || ''} onChange={e => setDigitalAsset({ ...digitalAsset, licenseKey: e.target.value })} />
                                </div>
                                <div>
                                    <label className={labelClasses}>Monthly Recurring Cost ($)</label>
                                    <input type="number" step="0.01" className={inputClasses} placeholder="199.99" value={digitalAsset.monthlyRecurringCost || ''} onChange={e => setDigitalAsset({ ...digitalAsset, monthlyRecurringCost: e.target.value })} />
                                </div>
                                <div>
                                    <label className={labelClasses}>Renewal Date</label>
                                    <input type="date" className={inputClasses} value={digitalAsset.renewalDate || ''} onChange={e => setDigitalAsset({ ...digitalAsset, renewalDate: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Dynamic Fields UI */}
                    {selectedCategory && (() => {
                        const grouped = getGroupedFields(selectedCategory);
                        const totalFields = grouped.reduce((sum, g) => sum + g.fields.length, 0);
                        return (
                        <div className={`${panelClasses} relative overflow-hidden animate-slide-up`}>
                             <div className="flex items-center justify-between mb-6 border-b border-border/60 pb-3">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">2</span>
                                    <h2 className="text-base font-semibold text-on-surface">Custom Matrix Data</h2>
                                </div>
                                <span className={`badge text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 ${assetType === 'PHYSICAL' ? 'bg-primary/10 text-primary' : assetType === 'DIGITAL' ? 'bg-oracle/10 text-oracle' : 'bg-cortex/10 text-cortex'} rounded-lg`}>
                                    {selectedCategory.icon} {selectedCategory.name}
                                </span>
                            </div>

                            {totalFields === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 bg-surface-container-low/30 rounded-xl border border-dashed border-border">
                                    <p className="text-sm text-muted-foreground">No custom tracking fields defined for this category.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {grouped.map((group, gi) => (
                                        <div key={gi}>
                                            {grouped.length > 1 && (
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-base">{group.icon}</span>
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.categoryName} Fields</span>
                                                    <div className="flex-1 h-px bg-muted/40"></div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {group.fields.map((def) => (
                                                    <div key={def.id} className={def.fieldType === 'JSON' ? 'md:col-span-2' : ''}>
                                                        <label className={labelClasses}>
                                                            {def.label} {def.required && <span className="text-primary">*</span>}
                                                        </label>

                                                        {def.fieldType === 'BOOLEAN' ? (
                                                            <div className="flex items-center gap-3 mt-3 bg-surface-container-low p-3 rounded-lg border border-border">
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 rounded border-border bg-surface-container accent-primary transition-all"
                                                                    checked={customFields[def.name] || false}
                                                                    onChange={e => handleCustomFieldChange(def.name, e.target.checked)}
                                                                />
                                                                <span className="text-sm font-medium text-foreground">Enable Feature</span>
                                                            </div>
                                                        ) : def.fieldType === 'DATE' ? (
                                                            <input
                                                                type="date"
                                                                required={def.required}
                                                                className={inputClasses}
                                                                value={customFields[def.name] || ''}
                                                                onChange={e => handleCustomFieldChange(def.name, e.target.value)}
                                                            />
                                                        ) : def.fieldType === 'JSON' ? (
                                                            <textarea
                                                                required={def.required}
                                                                className={`${inputClasses} resize-y min-h-[120px] font-mono whitespace-pre`}
                                                                placeholder='{\n  "config": true\n}'
                                                                value={customFields[def.name] || ''}
                                                                onChange={e => handleCustomFieldChange(def.name, e.target.value)}
                                                            />
                                                        ) : (
                                                            <input
                                                                type={def.fieldType === 'NUMBER' ? 'number' : 'text'}
                                                                required={def.required}
                                                                className={inputClasses}
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

                    {/* Submit Bar */}
                    <div className="sticky bottom-6 flex justify-between items-center bg-surface-container/95 border border-border p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] backdrop-blur-md z-10">
                        <div className="text-sm text-muted-foreground hidden sm:block">
                            {!selectedCategory ? 'Please select a core category to complete provisioning.' : 'Ready to provision asset.'}
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            <Link href="/assets" className="btn-secondary h-10 px-5 transition-colors text-sm rounded-lg flex items-center justify-center font-medium">Cancel</Link>
                            <button 
                                type="submit" 
                                disabled={!selectedCategory || submitting} 
                                className="primary-gradient-btn h-10 px-6 text-sm font-bold shadow-lg shadow-primary/20 text-on-primary inline-flex items-center justify-center gap-2 rounded-lg disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
                            >
                                {submitting
                                    ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-transparent border-t-on-primary" /> Provisioning…</>
                                    : 'Provision Asset'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
