'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
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
    const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);

    // Form State
    const [assetName, setAssetName] = useState('');
    const [assetStatus, setAssetStatus] = useState('AVAILABLE');
    const [assetType, setAssetType] = useState<'PHYSICAL' | 'DIGITAL' | 'DYNAMIC'>('PHYSICAL');
    const [customFields, setCustomFields] = useState<Record<string, any>>({});

    // Reset category selections whenever asset type changes
    useEffect(() => {
        setSelectedParentCategory(null);
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

        fetchCategories();
    }, [workspace?.id]);

    const applyCategory = (category: AssetCategory | null) => {
        setSelectedCategory(category);
        const initialCustom: Record<string, any> = {};
        if (category) {
            (category.fieldDefinitions || []).forEach(def => {
                initialCustom[def.name] = def.defaultValue || '';
                if (def.fieldType === 'BOOLEAN') initialCustom[def.name] = def.defaultValue === 'true';
            });
        }
        setCustomFields(initialCustom);
    };

    const handleParentCategorySelect = (categoryId: string) => {
        const parent = categories.find(c => c.id === categoryId) || null;
        setSelectedParentCategory(parent);
        // If this parent has no active children, treat it as the final selection
        const children = parent
            ? categories.filter(c => c.parentId === parent.id && c.isActive)
            : [];
        if (!parent || children.length === 0) {
            applyCategory(parent);
        } else {
            setSelectedCategory(null);
            setCustomFields({});
        }
    };

    const handleChildCategorySelect = (categoryId: string) => {
        const child = categories.find(c => c.id === categoryId) || null;
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
                    category: physicalAsset.category || 'OTHER',
                    processor: physicalAsset.processor,
                    ram: physicalAsset.ram ? parseInt(physicalAsset.ram) : undefined,
                    storage: physicalAsset.storage ? parseInt(physicalAsset.storage) : undefined,
                    osVersion: physicalAsset.osVersion,
                    macAddress: physicalAsset.macAddress,
                    ipAddress: physicalAsset.ipAddress,
                }
            } else if (assetType === 'DIGITAL') {
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

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <Link href="/assets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
                        <ArrowLeft size={14} />
                        Assets
                    </Link>
                    <h1 className="text-xl font-semibold text-foreground">Create Asset</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Provision a new tracked resource in this Workspace.</p>
                </div>
                <Link href="/admin/asset-categories" className="btn-outline h-8 text-sm px-3 inline-flex items-center gap-1.5">
                    <ExternalLink size={13} /> Manage Categories
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-5">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Step 1: Core Configuration */}
                    <div className="detail-panel">
                        <h2 className="detail-panel-title">1. Core Configuration</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Asset Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="input w-full"
                                    placeholder="e.g. Primary Edge Router"
                                    value={assetName}
                                    onChange={e => setAssetName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Initial Status *</label>
                                <select
                                    required
                                    className="input w-full"
                                    value={assetStatus}
                                    onChange={e => setAssetStatus(e.target.value)}
                                >
                                    <option value="AVAILABLE">✅ Available</option>
                                    <option value="ASSIGNED">👤 Assigned</option>
                                    <option value="MAINTENANCE">🔧 Maintenance</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-foreground mb-1.5">Asset Type Track *</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        className={`p-3.5 border rounded-xl text-center transition-all duration-150 ${assetType === 'PHYSICAL' ? 'border-primary bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`}
                                        onClick={() => setAssetType('PHYSICAL')}
                                    >
                                        <div className="text-sm font-semibold mb-0.5">Physical</div>
                                        <div className="text-xs opacity-70">Laptops, Servers, Network</div>
                                    </button>
                                    <button
                                        type="button"
                                        className={`p-3.5 border rounded-xl text-center transition-all duration-150 ${assetType === 'DIGITAL' ? 'border-primary bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`}
                                        onClick={() => setAssetType('DIGITAL')}
                                    >
                                        <div className="text-sm font-semibold mb-0.5">Digital</div>
                                        <div className="text-xs opacity-70">SaaS, Licenses, Domains</div>
                                    </button>
                                    <button
                                        type="button"
                                        className={`p-3.5 border rounded-xl text-center transition-all duration-150 ${assetType === 'DYNAMIC' ? 'border-primary bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`}
                                        onClick={() => setAssetType('DYNAMIC')}
                                    >
                                        <div className="text-sm font-semibold mb-0.5">Custom</div>
                                        <div className="text-xs opacity-70">Dynamic matrix</div>
                                    </button>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-nerve mb-2">Base Category *</label>
                                {(() => {
                                    const parentCats = categories.filter(
                                        c => !c.parentId && c.isActive && c.assetTypeValue === assetType
                                    );
                                    const childCats = selectedParentCategory
                                        ? categories.filter(c => c.parentId === selectedParentCategory.id && c.isActive)
                                        : [];
                                    return (
                                        <div className="space-y-3">
                                            <select
                                                required
                                                className="input w-full border-nerve/50 focus:border-nerve"
                                                value={selectedParentCategory?.id || ''}
                                                onChange={e => handleParentCategorySelect(e.target.value)}
                                            >
                                                <option value="" disabled>
                                                    {assetType === 'PHYSICAL' ? '🖥️ Select Hardware category…'
                                                        : assetType === 'DIGITAL' ? '💿 Select Software category…'
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
                                                        value={selectedCategory?.id || ''}
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
                                <p className="text-xs text-muted-foreground mt-2">
                                    Selecting a category determines which custom tracking fields apply to this asset.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 1.5: Hardware / Software Specifics */}
                    {assetType === 'PHYSICAL' && (
                        <div className="detail-panel">
                            <h2 className="detail-panel-title">Hardware Specifications</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Hardware Category</label>
                                    <select className="input w-full" value={physicalAsset.category || 'LAPTOP'} onChange={e => setPhysicalAsset({ ...physicalAsset, category: e.target.value })}>
                                        <option value="LAPTOP">Laptop</option>
                                        <option value="DESKTOP">Desktop</option>
                                        <option value="SERVER">Server / Rack</option>
                                        <option value="NETWORK_EQUIPMENT">Network Engine</option>
                                        <option value="MOBILE_DEVICE">Mobile Device</option>
                                        <option value="OTHER">Other / Peripheral</option>
                                    </select>
                                </div>
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
                                    <input type="text" className="input w-full" placeholder="Windows 11 Pro" value={physicalAsset.osVersion || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, osVersion: e.target.value })} />
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

                    {assetType === 'DIGITAL' && (
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

                    {/* Step 2: Dynamic Fields UI */}
                    {selectedCategory && (
                        <div className="detail-panel border-primary/20">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
                                <h2 className="text-sm font-semibold text-foreground">2. Custom Matrix Data</h2>
                                <span className="badge text-[11px] px-2.5 py-1 bg-primary/10 text-primary rounded-lg">{selectedCategory.icon} {selectedCategory.name}</span>
                            </div>

                            {(selectedCategory.fieldDefinitions || []).length === 0 ? (
                                <p className="text-sm text-muted-foreground/70 italic">No custom tracking fields required for this Class.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {(selectedCategory.fieldDefinitions || []).map((def) => (
                                        <div key={def.id} className={def.fieldType === 'JSON' ? 'md:col-span-2' : ''}>
                                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                                {def.label} {def.required && <span className="text-destructive">*</span>}
                                            </label>

                                            {def.fieldType === 'BOOLEAN' ? (
                                                <div className="flex items-center gap-2.5 mt-2">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-border accent-primary"
                                                        checked={customFields[def.name] || false}
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
                            )}
                        </div>
                    )}

                    {/* Submit */}
                    {selectedCategory && (
                        <div className="flex justify-end gap-2.5 pt-2 border-t border-border/60">
                            <Link href="/assets" className="btn-secondary h-9 text-sm px-4">Cancel</Link>
                            <button type="submit" disabled={submitting} className="btn-primary h-9 text-sm px-4 inline-flex items-center gap-2">
                                {submitting
                                    ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent" /> Provisioning…</>
                                    : 'Provision Asset'}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
