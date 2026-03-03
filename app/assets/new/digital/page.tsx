'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getDigitalAssetCategoryOptions, getLicenseTypeOptions, getHostTypeOptions, isHostRequired, isInstalledOnRelevant } from '@/lib/constants/digitalAssetConstants';
import { CSRFToken, fetchWithCSRF } from '@/components/security/CSRFToken';
import { useToast } from '@/lib/toast';

export default function NewDigitalAssetPage() {
    const router = useRouter();
    const { success, error: showError } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        description: '',
        vendor: '',
        version: '',
        licenseType: '',
        licenseKey: '',
        seatCount: '',
        seatsUsed: '',
        subscriptionTier: '',
        monthlyRecurringCost: '',
        renewalDate: '',
        autoRenew: false,
        host: '',
        hostType: '',
        url: '',
        sslExpiry: '',
        connectionString: '',
        databaseSize: '',
        installedOn: [] as string[],
    });

    const [physicalAssets, setPhysicalAssets] = useState<Array<{ id: string; name: string; physicalAsset?: { category?: string } }>>([]);

    // Fetch physical assets for installedOn field
    useEffect(() => {
        const fetchPhysicalAssets = async () => {
            try {
                const response = await csrfFetch('/api/assets?assetType=PHYSICAL&limit=100');
                const data = await response.json();
                setPhysicalAssets(data.assets || []);
            } catch (error: unknown) {
                showError('Failed to fetch physical assets', error instanceof Error ? error.message : 'Unknown error');
            }
        };
        fetchPhysicalAssets();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                assetType: 'DIGITAL',
                ...formData,
                seatCount: formData.seatCount ? parseInt(formData.seatCount) : null,
                seatsUsed: formData.seatsUsed ? parseInt(formData.seatsUsed) : null,
                monthlyRecurringCost: formData.monthlyRecurringCost ? parseFloat(formData.monthlyRecurringCost) : null,
                databaseSize: formData.databaseSize ? parseInt(formData.databaseSize) : null,
            };

            const response = await fetchWithCSRF('/api/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create digital asset');
            }

            const asset = await response.json();
            success(`Digital asset "${asset.name}" created successfully`);
            router.push(`/assets/${asset.id}`);
        } catch (error: unknown) {
            showError('Failed to create digital asset', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const showHostFields = formData.category && (
        isHostRequired(formData.category) ||
        ['SAAS_SUBSCRIPTION', 'CLOUD_STORAGE'].includes(formData.category)
    );

    const showInstalledOnField = formData.category && isInstalledOnRelevant(formData.category);

    return (
        <>

            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="mb-6">
                    <button
                        onClick={() => router.back()}
                        className="text-muted-foreground hover:text-foreground mb-4"
                    >
                        ← Back
                    </button>
                    <h1 className="text-3xl font-bold">💿 Add Digital Asset</h1>
                    <p className="text-muted-foreground mt-2">
                        Create a new digital asset (applications, SaaS, databases, licenses, etc.)
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="card space-y-6">
                    <CSRFToken />
                    {/* Basic Information */}
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="label">Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Microsoft Office 365, AWS Account, PostgreSQL"
                                />
                            </div>

                            <div>
                                <label className="label">Category *</label>
                                <select
                                    required
                                    className="input"
                                    aria-label="Category"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    <option value="">Select category</option>
                                    {getDigitalAssetCategoryOptions().map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Vendor</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.vendor}
                                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                                    placeholder="e.g., Microsoft, AWS, Oracle"
                                />
                            </div>

                            <div>
                                <label className="label">Version</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.version}
                                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                    placeholder="e.g., 2024, 14.5, v1.2.3"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="label">Description</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief description of this digital asset and its purpose"
                                />
                            </div>
                        </div>
                    </div>

                    {/* License Information */}
                    <div>
                        <h2 className="text-xl font-semibold mb-4">🔑 License Information</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">License Type</label>
                                <select
                                    className="input"
                                    aria-label="License Type"
                                    value={formData.licenseType}
                                    onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
                                >
                                    <option value="">Select type</option>
                                    {getLicenseTypeOptions().map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">License Key</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.licenseKey}
                                    onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                />
                            </div>

                            <div>
                                <label className="label">Total Seats</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="input"
                                    value={formData.seatCount}
                                    onChange={(e) => setFormData({ ...formData, seatCount: e.target.value })}
                                    placeholder="e.g., 50"
                                />
                            </div>

                            <div>
                                <label className="label">Seats Used</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="input"
                                    value={formData.seatsUsed}
                                    onChange={(e) => setFormData({ ...formData, seatsUsed: e.target.value })}
                                    placeholder="e.g., 42"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SaaS Subscription Fields */}
                    {formData.category === 'SAAS_SUBSCRIPTION' && (
                        <div>
                            <h2 className="text-xl font-semibold mb-4">☁️ Subscription Details</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Subscription Tier</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={formData.subscriptionTier}
                                        onChange={(e) => setFormData({ ...formData, subscriptionTier: e.target.value })}
                                        placeholder="e.g., Enterprise, Pro, Basic"
                                    />
                                </div>

                                <div>
                                    <label className="label">Monthly Cost ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="input"
                                        value={formData.monthlyRecurringCost}
                                        onChange={(e) => setFormData({ ...formData, monthlyRecurringCost: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="label">Renewal Date</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={formData.renewalDate}
                                        onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                                    />
                                </div>

                                <div className="flex items-center">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.autoRenew}
                                            onChange={(e) => setFormData({ ...formData, autoRenew: e.target.checked })}
                                            className="w-4 h-4"
                                        />
                                        <span>Auto-renew enabled</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hosting Information */}
                    {showHostFields && (
                        <div>
                            <h2 className="text-xl font-semibold mb-4">🏢 Hosting Information</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">
                                        Host Type {isHostRequired(formData.category) && '*'}
                                    </label>
                                    <select
                                        required={isHostRequired(formData.category)}
                                        className="input"
                                        value={formData.hostType}
                                        onChange={(e) => setFormData({ ...formData, hostType: e.target.value })}
                                    >
                                        <option value="">Select host type</option>
                                        {getHostTypeOptions().map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="label">
                                        Host {isHostRequired(formData.category) && '*'}
                                    </label>
                                    <input
                                        type="text"
                                        required={isHostRequired(formData.category)}
                                        className="input"
                                        value={formData.host}
                                        onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                                        placeholder={
                                            formData.hostType === 'PROVIDER'
                                                ? 'e.g., AWS, Azure, Google Cloud'
                                                : 'e.g., asset_server01'
                                        }
                                    />
                                    {formData.hostType === 'ASSET' && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Enter the Asset ID of the physical asset hosting this digital asset
                                        </p>
                                    )}
                                </div>

                                {(formData.category === 'WEB_APPLICATION' || formData.category === 'API_SERVICE') && (
                                    <>
                                        <div>
                                            <label className="label">URL</label>
                                            <input
                                                type="url"
                                                className="input"
                                                value={formData.url}
                                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                                placeholder="https://example.com"
                                            />
                                        </div>

                                        <div>
                                            <label className="label">SSL Expiry Date</label>
                                            <input
                                                type="date"
                                                className="input"
                                                value={formData.sslExpiry}
                                                onChange={(e) => setFormData({ ...formData, sslExpiry: e.target.value })}
                                            />
                                        </div>
                                    </>
                                )}

                                {formData.category === 'DATABASE' && (
                                    <>
                                        <div className="col-span-2">
                                            <label className="label">Connection String</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={formData.connectionString}
                                                onChange={(e) => setFormData({ ...formData, connectionString: e.target.value })}
                                                placeholder="postgresql://user:pass@host:5432/db"
                                            />
                                        </div>

                                        <div>
                                            <label className="label">Database Size (MB)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="input"
                                                value={formData.databaseSize}
                                                onChange={(e) => setFormData({ ...formData, databaseSize: e.target.value })}
                                                placeholder="e.g., 5120"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Installation Tracking */}
                    {showInstalledOnField && (
                        <div>
                            <h2 className="text-xl font-semibold mb-4">📲 Installation Tracking</h2>
                            <div>
                                <label className="label">Installed On (Devices)</label>
                                <select
                                    multiple
                                    className="input min-h-[200px]"
                                    value={formData.installedOn}
                                    onChange={(e) => {
                                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                                        setFormData({ ...formData, installedOn: selected });
                                    }}
                                >
                                    {physicalAssets.map((asset) => (
                                        <option key={asset.id} value={asset.id}>
                                            {asset.name} ({asset.physicalAsset?.category || 'Unknown'})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Hold Cmd/Ctrl to select multiple devices where this software is installed
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Submit Buttons */}
                    <div className="flex gap-4 pt-4 border-t">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? 'Creating...' : '✓ Create Digital Asset'}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
