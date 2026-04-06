'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { PageSpinner } from '@/components/ui/Spinner';
import { useToast } from '@/lib/toast';

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
    fieldDefinitions: FieldDefinition[];
}

export default function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { success, error: toastError } = useToast();

    const [id, setId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Engine State
    const [category, setCategory] = useState<AssetCategory | null>(null);
    const [categoriesList, setCategoriesList] = useState<AssetCategory[]>([]); // needed if they want to change classes? (Usually prohibited but supported in backend)

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
        params.then(({ id: assetId }) => {
            setId(assetId);
            fetchAsset(assetId);
        });
    }, [params]);

    const fetchAsset = async (assetId: string) => {
        try {
            // 1. Fetch Engine Schemas just in case they change the Class type
            const catRes = await csrfFetch(`/api/assets/categories`);
            if (catRes.ok) {
                const catData = await catRes.json();
                setCategoriesList(catData.data || []);
            }

            // 2. Fetch the specific Node
            const response = await csrfFetch(`/api/assets/${assetId}`);
            if (!response.ok) throw new Error('Failed to load asset');

            const result = await response.json();
            const asset = result.data || result; // Backend inconsistency guard

            setCategory(asset.category || null);

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

            // Map the arrays (AssetFieldValue[]) out into dictionary mappings aligned against field definition 'names'.
            if (asset.category?.fieldDefinitions && asset.fieldValues) {
                asset.category.fieldDefinitions.forEach((def: FieldDefinition) => {
                    // Find existing value in database array
                    const record = asset.fieldValues.find((fv: any) => fv.fieldDefinitionId === def.id);
                    if (record) {
                        // Hydrate cast
                        if (def.fieldType === 'BOOLEAN') existingCustomState[def.name] = record.value === 'true';
                        else existingCustomState[def.name] = record.value;
                    } else {
                        // Fallbacks
                        existingCustomState[def.name] = def.fieldType === 'BOOLEAN' ? false : '';
                    }
                });
            }
            setCustomFields(existingCustomState);
            setLoading(false);

        } catch (err: any) {
            toastError('Failed to load Editor', err.message);
            setLoading(false);
        }
    };

    const handleCategoryChange = (newCategoryId: string) => {
        const newCat = categoriesList.find(c => c.id === newCategoryId);
        if (!newCat) return;

        setCategory(newCat);
        setFormData(prev => ({ ...prev, categoryId: newCategoryId }));

        // Reset and map variables for the new class schema
        const initialCustom: Record<string, any> = {};
        newCat.fieldDefinitions.forEach(def => {
            initialCustom[def.name] = def.defaultValue || '';
            if (def.fieldType === 'BOOLEAN') initialCustom[def.name] = def.defaultValue === 'true';
        });
        setCustomFields(initialCustom);
    }

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

                        <div>
                            <label className="block text-sm font-medium text-nerve mb-2">Engine Class</label>
                            <select
                                value={formData.categoryId}
                                onChange={(e) => handleCategoryChange(e.target.value)}
                                className="input w-full border-nerve/30 focus:border-nerve"
                            >
                                {categoriesList.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground mt-1">Warning: Changing the Class will erase existing custom variables on Save.</p>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-foreground mb-1.5">Asset Type Track *</label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    className={`p-3.5 border rounded-xl text-center transition-all duration-150 ${formData.assetType === 'PHYSICAL' ? 'border-primary bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`}
                                    onClick={() => updateField('assetType', 'PHYSICAL')}
                                >
                                    <div className="text-sm font-semibold mb-0.5">Physical</div>
                                    <div className="text-xs opacity-70">Laptops, Servers, Network</div>
                                </button>
                                <button
                                    type="button"
                                    className={`p-3.5 border rounded-xl text-center transition-all duration-150 ${formData.assetType === 'DIGITAL' ? 'border-primary bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`}
                                    onClick={() => updateField('assetType', 'DIGITAL')}
                                >
                                    <div className="text-sm font-semibold mb-0.5">Digital</div>
                                    <div className="text-xs opacity-70">SaaS, Licenses, Domains</div>
                                </button>
                                <button
                                    type="button"
                                    className={`p-3.5 border rounded-xl text-center transition-all duration-150 ${formData.assetType === 'DYNAMIC' ? 'border-primary bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`}
                                    onClick={() => updateField('assetType', 'DYNAMIC')}
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
                {category && (
                    <div className="detail-panel border-primary/20">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
                            <h2 className="text-sm font-semibold text-foreground">2. Custom Matrix Data</h2>
                            <span className="badge text-[11px] px-2.5 py-1 bg-primary/10 text-primary rounded-lg">{category.icon} {category.name}</span>
                        </div>

                        {category.fieldDefinitions.length === 0 ? (
                            <p className="text-sm text-muted-foreground/70 italic">No custom tracking fields required for this Class.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {category.fieldDefinitions.map((def) => (
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
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                    <Link href={`/assets/${id}`} className="btn-secondary h-9 text-sm px-4">
                        Discard
                    </Link>
                    <button
                        type="submit"
                        disabled={submitting}
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
