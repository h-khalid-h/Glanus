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
    fieldDefinitions: FieldDefinition[];
}

export default function DynamicAssetCreatePage() {
    const router = useRouter();
    const { workspace } = useWorkspace();
    const { success, error: toastError } = useToast();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [categories, setCategories] = useState<AssetCategory[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);

    // Form State
    const [assetName, setAssetName] = useState('');
    const [assetStatus, setAssetStatus] = useState('AVAILABLE');
    const [assetType, setAssetType] = useState<'PHYSICAL' | 'DIGITAL' | 'DYNAMIC'>('PHYSICAL');
    const [customFields, setCustomFields] = useState<Record<string, any>>({});

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

    const handleCategorySelect = (categoryId: string) => {
        const category = categories.find(c => c.id === categoryId) || null;
        setSelectedCategory(category);

        // Reset dynamic state on switch
        const initialCustom: Record<string, any> = {};
        if (category) {
            (category.fieldDefinitions || []).forEach(def => {
                initialCustom[def.name] = def.defaultValue || '';
                if (def.fieldType === 'BOOLEAN') initialCustom[def.name] = def.defaultValue === 'true';
            });
        }
        setCustomFields(initialCustom);
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
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <Link href="/assets" className="inline-flex items-center gap-2 text-nerve hover:text-nerve mb-4">
                        <ArrowLeft size={20} />
                        Back to Assets
                    </Link>
                    <h1 className="text-3xl font-bold text-foreground">Create Asset</h1>
                    <p className="text-slate-400 mt-2">Provision a new tracked resource in this Workspace.</p>
                </div>
                <Link href="/admin/categories" className="btn-secondary text-sm flex items-center gap-2">
                    <ExternalLink size={16} /> Manage Categories
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Step 1: Core Configuration */}
                    <div className="card">
                        <h2 className="text-xl font-bold text-foreground mb-6 border-b border-border pb-4">1. Core Configuration</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Asset Name *</label>
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
                                <label className="block text-sm font-medium text-slate-300 mb-2">Initial Status *</label>
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
                                <label className="block text-sm font-medium text-slate-300 mb-2">Asset Type Track *</label>
                                <div className="grid grid-cols-3 gap-4">
                                    <button
                                        type="button"
                                        className={`p-4 border rounded-lg text-center transition-all ${assetType === 'PHYSICAL' ? 'border-nerve bg-nerve/10 text-nerve' : 'border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                                        onClick={() => setAssetType('PHYSICAL')}
                                    >
                                        <div className="font-bold mb-1">Physical Hardware</div>
                                        <div className="text-xs opacity-70">Laptops, Servers, Network</div>
                                    </button>
                                    <button
                                        type="button"
                                        className={`p-4 border rounded-lg text-center transition-all ${assetType === 'DIGITAL' ? 'border-nerve bg-nerve/10 text-nerve' : 'border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                                        onClick={() => setAssetType('DIGITAL')}
                                    >
                                        <div className="font-bold mb-1">Digital Asset</div>
                                        <div className="text-xs opacity-70">SaaS, Licenses, Domains</div>
                                    </button>
                                    <button
                                        type="button"
                                        className={`p-4 border rounded-lg text-center transition-all ${assetType === 'DYNAMIC' ? 'border-nerve bg-nerve/10 text-nerve' : 'border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                                        onClick={() => setAssetType('DYNAMIC')}
                                    >
                                        <div className="font-bold mb-1">Custom / Other</div>
                                        <div className="text-xs opacity-70">Pure dynamic matrix</div>
                                    </button>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-nerve mb-2">Base Category Class *</label>
                                <select
                                    required
                                    className="input w-full border-nerve/50 focus:border-nerve"
                                    value={selectedCategory?.id || ''}
                                    onChange={e => handleCategorySelect(e.target.value)}
                                >
                                    <option value="" disabled>Select a pre-defined Engine Class...</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-2">
                                    Selecting a class determines which dynamically tracking fields apply to this asset regardless of origin type.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 1.5: Hardware / Software Specifics */}
                    {assetType === 'PHYSICAL' && (
                        <div className="card">
                            <h2 className="text-xl font-bold text-foreground mb-6 border-b border-border pb-4">Hardware Specifications</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Hardware Category</label>
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
                                    <label className="block text-sm font-medium text-slate-300 mb-2">MAC Address</label>
                                    <input type="text" className="input w-full" placeholder="00:00:00:00:00:00" value={physicalAsset.macAddress || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, macAddress: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">IP Address / Host</label>
                                    <input type="text" className="input w-full" placeholder="192.168.1.100" value={physicalAsset.ipAddress || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, ipAddress: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">OS Version</label>
                                    <input type="text" className="input w-full" placeholder="Windows 11 Pro" value={physicalAsset.osVersion || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, osVersion: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">RAM (GB)</label>
                                    <input type="number" className="input w-full" placeholder="16" value={physicalAsset.ram || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, ram: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Storage Array (GB)</label>
                                    <input type="number" className="input w-full" placeholder="512" value={physicalAsset.storage || ''} onChange={e => setPhysicalAsset({ ...physicalAsset, storage: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    )}

                    {assetType === 'DIGITAL' && (
                        <div className="card">
                            <h2 className="text-xl font-bold text-foreground mb-6 border-b border-border pb-4">Software & License Metrics</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Software Category</label>
                                    <select className="input w-full" value={digitalAsset.category || 'SAAS_SUBSCRIPTION'} onChange={e => setDigitalAsset({ ...digitalAsset, category: e.target.value })}>
                                        <option value="SAAS_SUBSCRIPTION">SaaS Subscription</option>
                                        <option value="LICENSE">License Key</option>
                                        <option value="API_SERVICE">API Service / Cloud</option>
                                        <option value="WEB_APPLICATION">Web App Domain</option>
                                        <option value="OTHER">Other Digital Space</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Vendor / Provider</label>
                                    <input type="text" className="input w-full" placeholder="e.g. Microsoft, AWS" value={digitalAsset.vendor || ''} onChange={e => setDigitalAsset({ ...digitalAsset, vendor: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">License Type</label>
                                    <select className="input w-full" value={digitalAsset.licenseType || 'SUBSCRIPTION'} onChange={e => setDigitalAsset({ ...digitalAsset, licenseType: e.target.value })}>
                                        <option value="SUBSCRIPTION">Recurring Subscription</option>
                                        <option value="PERPETUAL">Perpetual (One-time)</option>
                                        <option value="OPEN_SOURCE">Open Source</option>
                                        <option value="ENTERPRISE">Enterprise Agreement</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Seat Count / Licenses</label>
                                    <input type="number" className="input w-full" placeholder="50" value={digitalAsset.seatCount || ''} onChange={e => setDigitalAsset({ ...digitalAsset, seatCount: e.target.value })} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">License Key / Access Token</label>
                                    <input type="text" className="input w-full font-mono text-xs" placeholder="XXXX-XXXX-XXXX-XXXX" value={digitalAsset.licenseKey || ''} onChange={e => setDigitalAsset({ ...digitalAsset, licenseKey: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Monthly Cost</label>
                                    <input type="number" step="0.01" className="input w-full" placeholder="$0.00" value={digitalAsset.monthlyRecurringCost || ''} onChange={e => setDigitalAsset({ ...digitalAsset, monthlyRecurringCost: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Renewal Date</label>
                                    <input type="date" className="input w-full" value={digitalAsset.renewalDate || ''} onChange={e => setDigitalAsset({ ...digitalAsset, renewalDate: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Dynamic Fields UI */}
                    {selectedCategory && (
                        <div className="card border-nerve/30">
                            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3 border-b border-border pb-4">
                                <span>2. Custom Matrix Data</span>
                                <span className="text-sm px-3 py-1 bg-nerve/20 text-nerve rounded-full">{selectedCategory.icon} {selectedCategory.name}</span>
                            </h2>

                            {(selectedCategory.fieldDefinitions || []).length === 0 ? (
                                <p className="text-slate-500 italic">No custom tracking fields required for this Class.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {(selectedCategory.fieldDefinitions || []).map((def) => (
                                        <div key={def.id} className={def.fieldType === 'JSON' ? 'md:col-span-2' : ''}>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                                {def.label} {def.required && <span className="text-red-400">*</span>}
                                            </label>

                                            {def.fieldType === 'BOOLEAN' ? (
                                                <div className="flex items-center gap-3 mt-3">
                                                    <input
                                                        type="checkbox"
                                                        className="w-5 h-5 rounded border-slate-700 text-nerve focus:ring-nerve"
                                                        checked={customFields[def.name] || false}
                                                        onChange={e => handleCustomFieldChange(def.name, e.target.checked)}
                                                    />
                                                    <span className="text-sm text-slate-400">Enable</span>
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

                    {/* Submit Matrix */}
                    {selectedCategory && (
                        <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-800">
                            <Link href="/assets" className="btn-secondary">Cancel</Link>
                            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                                {submitting ? <PageSpinner /> : 'Provision Asset Node'}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
