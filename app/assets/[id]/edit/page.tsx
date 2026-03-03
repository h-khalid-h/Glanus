'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageSpinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import { getCategoryOptions, getStatusOptions } from '@/lib/constants/assetConstants';

const categoryOptions = getCategoryOptions();
const statusOptions = getStatusOptions();

export default function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
    const [id, setId] = useState<string>('');
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        category: categoryOptions[0].value,
        manufacturer: '',
        model: '',
        serialNumber: '',
        status: 'AVAILABLE',
        purchaseDate: '',
        purchaseCost: '',
        warrantyUntil: '',
        location: '',
        description: '',
        tags: '',
    });

    // Unwrap params and fetch asset data
    useEffect(() => {
        params.then(({ id: assetId }) => {
            setId(assetId);
            fetchAsset(assetId);
        });
    }, [params]);

    const fetchAsset = async (assetId: string) => {
        try {
            const response = await csrfFetch(`/api/assets/${assetId}`);
            if (!response.ok) {
                throw new Error('Failed to load asset');
            }

            const asset = await response.json();

            // Pre-fill form with existing data
            setFormData({
                name: asset.name || '',
                category: asset.category || categoryOptions[0].value,
                manufacturer: asset.manufacturer || '',
                model: asset.model || '',
                serialNumber: asset.serialNumber || '',
                status: asset.status || 'AVAILABLE',
                purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
                purchaseCost: asset.purchaseCost ? asset.purchaseCost.toString() : '',
                warrantyUntil: asset.warrantyUntil ? asset.warrantyUntil.split('T')[0] : '',
                location: asset.location || '',
                description: asset.description || '',
                tags: Array.isArray(asset.tags) ? asset.tags.join(', ') : '',
            });

            setLoading(false);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
            setLoading(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            const payload = {
                ...formData,
                purchaseCost: formData.purchaseCost ? parseFloat(formData.purchaseCost) : null,
                tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            };

            const response = await csrfFetch(`/api/assets/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update asset');
            }

            const asset = await response.json();
            router.push(`/assets/${asset.id}`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
            setSubmitting(false);
        }
    };

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return (
            <>
                <PageSpinner text="Loading asset..." />
                );
    }

                return (
                <>

                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        {/* Header */}
                        <div className="flex items-center gap-4 mb-8">
                            <Link
                                href={`/assets/${id}`}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <svg
                                    className="w-6 h-6"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path d="M15 19l-7-7 7-7" />
                                </svg>
                            </Link>
                            <div>
                                <h1 className="text-3xl font-bold text-foreground">Edit Asset</h1>
                                <p className="text-muted-foreground mt-1">
                                    Update asset information
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="card bg-health-critical/10 border-health-critical/20 mb-6">
                                <div className="flex items-center gap-2 text-health-critical">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm font-medium">{error}</span>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Basic Information */}
                            <div className="card">
                                <h2 className="text-xl font-semibold text-foreground mb-6">Basic Information</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                                            Asset Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            required
                                            value={formData.name}
                                            onChange={(e) => updateField('name', e.target.value)}
                                            className="input w-full"
                                            placeholder="e.g., MacBook Pro 16-inch"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="category" className="block text-sm font-medium text-foreground mb-2">
                                            Category <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            id="category"
                                            required
                                            value={formData.category}
                                            onChange={(e) => updateField('category', e.target.value)}
                                            className="input w-full"
                                        >
                                            {categoryOptions.map(cat => (
                                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="status" className="block text-sm font-medium text-foreground mb-2">
                                            Status
                                        </label>
                                        <select
                                            id="status"
                                            value={formData.status}
                                            onChange={(e) => updateField('status', e.target.value)}
                                            className="input w-full"
                                        >
                                            {statusOptions.map(status => (
                                                <option key={status.value} value={status.value}>{status.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="manufacturer" className="block text-sm font-medium text-foreground mb-2">
                                            Manufacturer
                                        </label>
                                        <input
                                            type="text"
                                            id="manufacturer"
                                            value={formData.manufacturer}
                                            onChange={(e) => updateField('manufacturer', e.target.value)}
                                            className="input w-full"
                                            placeholder="e.g., Apple, Dell, HP"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="model" className="block text-sm font-medium text-foreground mb-2">
                                            Model
                                        </label>
                                        <input
                                            type="text"
                                            id="model"
                                            value={formData.model}
                                            onChange={(e) => updateField('model', e.target.value)}
                                            className="input w-full"
                                            placeholder="e.g., XPS 15, ThinkPad X1"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="serialNumber" className="block text-sm font-medium text-foreground mb-2">
                                            Serial Number
                                        </label>
                                        <input
                                            type="text"
                                            id="serialNumber"
                                            value={formData.serialNumber}
                                            onChange={(e) => updateField('serialNumber', e.target.value)}
                                            className="input w-full font-mono"
                                            placeholder="e.g., C02XK1GYHJKL"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="location" className="block text-sm font-medium text-foreground mb-2">
                                            Location
                                        </label>
                                        <input
                                            type="text"
                                            id="location"
                                            value={formData.location}
                                            onChange={(e) => updateField('location', e.target.value)}
                                            className="input w-full"
                                            placeholder="e.g., Office 3rd Floor"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
                                            Description
                                        </label>
                                        <textarea
                                            id="description"
                                            value={formData.description}
                                            onChange={(e) => updateField('description', e.target.value)}
                                            rows={3}
                                            className="input w-full"
                                            placeholder="Additional details about this asset..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Purchase Information */}
                            <div className="card">
                                <h2 className="text-xl font-semibold text-foreground mb-6">Purchase Information</h2>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label htmlFor="purchaseDate" className="block text-sm font-medium text-foreground mb-2">
                                            Purchase Date
                                        </label>
                                        <input
                                            type="date"
                                            id="purchaseDate"
                                            value={formData.purchaseDate}
                                            onChange={(e) => updateField('purchaseDate', e.target.value)}
                                            className="input w-full"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="purchaseCost" className="block text-sm font-medium text-foreground mb-2">
                                            Purchase Cost
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                $
                                            </span>
                                            <input
                                                type="number"
                                                id="purchaseCost"
                                                value={formData.purchaseCost}
                                                onChange={(e) => updateField('purchaseCost', e.target.value)}
                                                className="input w-full pl-7"
                                                placeholder="0.00"
                                                step="0.01"
                                                min="0"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="warrantyUntil" className="block text-sm font-medium text-foreground mb-2">
                                            Warranty Until
                                        </label>
                                        <input
                                            type="date"
                                            id="warrantyUntil"
                                            value={formData.warrantyUntil}
                                            onChange={(e) => updateField('warrantyUntil', e.target.value)}
                                            className="input w-full"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="card">
                                <h2 className="text-xl font-semibold text-foreground mb-6">Tags</h2>

                                <div>
                                    <label htmlFor="tags" className="block text-sm font-medium text-foreground mb-2">
                                        Tags (comma-separated)
                                    </label>
                                    <input
                                        type="text"
                                        id="tags"
                                        value={formData.tags}
                                        onChange={(e) => updateField('tags', e.target.value)}
                                        className="input w-full"
                                        placeholder="e.g., executive, high-priority, remote-work"
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Separate tags with commas. These help organize and filter assets.
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3">
                                <Link href={`/assets/${id}`} className="btn-secondary">
                                    Cancel
                                </Link>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
                );
}
