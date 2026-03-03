'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCategoryOptions } from '@/lib/constants/assetConstants';
import { CSRFToken, fetchWithCSRF } from '@/components/security/CSRFToken';
import { useToast } from '@/lib/toast';

export default function NewPhysicalAssetPage() {
    const router = useRouter();
    const { success, error: showError } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        description: '',
        manufacturer: '',
        model: '',
        serialNumber: '',
        processor: '',
        ram: '',
        storage: '',
        osVersion: '',
        macAddress: '',
        ipAddress: '',
        location: '',
        purchaseDate: '',
        purchaseCost: '',
        warrantyUntil: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                assetType: 'PHYSICAL',
                ...formData,
                purchaseCost: formData.purchaseCost ? parseFloat(formData.purchaseCost) : null,
                ram: formData.ram ? parseInt(formData.ram) : null,
                storage: formData.storage ? parseInt(formData.storage) : null,
            };

            const response = await fetchWithCSRF('/api/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create physical asset');
            }

            const asset = await response.json();
            success(`Asset "${asset.name}" created successfully`);
            router.push(`/assets/${asset.id}`);
        } catch (error: unknown) {
            showError('Failed to create asset', error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

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
                    <h1 className="text-3xl font-bold">🖥️ Add Physical Asset</h1>
                    <p className="text-muted-foreground mt-2">
                        Create a new physical asset (laptops, servers, printers, etc.)
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="card space-y-6">
                    <CSRFToken />
                    {/* Basic Information */}
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="label">Asset Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., MacBook Pro 16 - John Doe"
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
                                    {getCategoryOptions().map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Manufacturer</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.manufacturer}
                                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                                    placeholder="e.g., Apple, Dell, HP"
                                />
                            </div>

                            <div>
                                <label className="label">Model</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.model}
                                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                    placeholder="e.g., MacBook Pro 16-inch 2024"
                                />
                            </div>

                            <div>
                                <label className="label">Serial Number</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.serialNumber}
                                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                    placeholder="e.g., C02ABC123XYZ"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="label">Description</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief description of this asset"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Technical Specifications */}
                    <div>
                        <h2 className="text-xl font-semibold mb-4">⚙️ Technical Specifications</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Processor</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.processor}
                                    onChange={(e) => setFormData({ ...formData, processor: e.target.value })}
                                    placeholder="e.g., M3 Pro, Intel i7-13700K"
                                />
                            </div>

                            <div>
                                <label className="label">RAM (GB)</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="input"
                                    value={formData.ram}
                                    onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                                    placeholder="e.g., 16"
                                />
                            </div>

                            <div>
                                <label className="label">Storage (GB)</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="input"
                                    value={formData.storage}
                                    onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                                    placeholder="e.g., 512"
                                />
                            </div>

                            <div>
                                <label className="label">Operating System</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.osVersion}
                                    onChange={(e) => setFormData({ ...formData, osVersion: e.target.value })}
                                    placeholder="e.g., macOS 14.2, Windows 11"
                                />
                            </div>

                            <div>
                                <label className="label">MAC Address</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.macAddress}
                                    onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                                    placeholder="e.g., 00:1B:44:11:3A:B7"
                                />
                            </div>

                            <div>
                                <label className="label">IP Address</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.ipAddress}
                                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                                    placeholder="e.g., 192.168.1.100"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Procurement & Location */}
                    <div>
                        <h2 className="text-xl font-semibold mb-4">📍 Procurement & Location</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Location</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="e.g., Office Floor 3, Warehouse B"
                                />
                            </div>

                            <div>
                                <label className="label">Purchase Cost ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="input"
                                    value={formData.purchaseCost}
                                    onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="label">Purchase Date</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={formData.purchaseDate}
                                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label">Warranty Until</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={formData.warrantyUntil}
                                    onChange={(e) => setFormData({ ...formData, warrantyUntil: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-4 pt-4 border-t">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? 'Creating...' : '✓ Create Physical Asset'}
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
