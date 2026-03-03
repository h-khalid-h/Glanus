'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface PartnerSignupFormData {
    companyName: string;
    businessNumber: string;
    website: string;
    phone: string;
    bio: string;
    address: string;
    city: string;
    region: string;
    country: string;
    timezone: string;
    serviceRadius: number;
    remoteOnly: boolean;
    industries: string[];
    certifications: string[];
    languages: string[];
}

const INDUSTRIES = [
    'Healthcare',
    'Finance',
    'Education',
    'Manufacturing',
    'Retail',
    'Technology',
    'Legal',
    'Real Estate',
    'Hospitality',
    'Other',
];

const CERTIFICATIONS = [
    'CompTIA A+',
    'CompTIA Network+',
    'CompTIA Security+',
    'Cisco CCNA',
    'Microsoft Certified',
    'AWS Certified',
    'Google Cloud Certified',
    'ITIL Foundation',
    'Other',
];

export default function PartnerSignupPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState<PartnerSignupFormData>({
        companyName: '',
        businessNumber: '',
        website: '',
        phone: '',
        bio: '',
        address: '',
        city: '',
        region: '',
        country: 'US',
        timezone: 'America/New_York',
        serviceRadius: 50,
        remoteOnly: false,
        industries: [],
        certifications: [],
        languages: ['en'],
    });

    const updateField = (field: keyof PartnerSignupFormData, value: PartnerSignupFormData[typeof field]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const toggleArrayItem = (field: 'industries' | 'certifications' | 'languages', item: string) => {
        setFormData((prev) => ({
            ...prev,
            [field]: prev[field].includes(item)
                ? prev[field].filter((i) => i !== item)
                : [...prev[field], item],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await csrfFetch('/api/partners/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Signup failed');
            }

            // Success - redirect to dashboard
            router.push('/partners/dashboard?welcome=true');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => setStep((s) => Math.min(s + 1, 4));
    const prevStep = () => setStep((s) => Math.max(s - 1, 1));

    return (
        <div className="min-h-screen bg-slate-900/30 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">Become a Glanus Partner</h1>
                    <p className="text-lg text-slate-400">
                        Join our certified partner network and earn 50% revenue share
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className="flex items-center">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${s <= step
                                        ? 'bg-nerve text-white'
                                        : 'bg-slate-700 text-slate-500'
                                        }`}
                                >
                                    {s}
                                </div>
                                {s < 4 && (
                                    <div
                                        className={`h-1 w-24 mx-2 ${s < step ? 'bg-nerve' : 'bg-slate-700'
                                            }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-sm text-slate-400">
                        <span>Company</span>
                        <span>Profile</span>
                        <span>Location</span>
                        <span>Expertise</span>
                    </div>
                </div>

                {/* Form */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-8">
                    <form onSubmit={handleSubmit}>
                        {/* Step 1: Company Info */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-semibold mb-4">Company Information</h2>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Company Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.companyName}
                                        onChange={(e) => updateField('companyName', e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                        placeholder="Acme IT Services"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Business Number (Tax ID / EIN)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.businessNumber}
                                        onChange={(e) => updateField('businessNumber', e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                        placeholder="12-3456789"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Website
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.website}
                                        onChange={(e) => updateField('website', e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                        placeholder="https://acmeit.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Phone *
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => updateField('phone', e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                        placeholder="+1-555-0100"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Profile */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-semibold mb-4">Company Profile</h2>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        About Your Company
                                    </label>
                                    <textarea
                                        rows={6}
                                        value={formData.bio}
                                        onChange={(e) => updateField('bio', e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                        placeholder="Tell potential clients about your experience, expertise, and what makes your company unique..."
                                    />
                                    <p className="mt-1 text-sm text-slate-500">
                                        {formData.bio.length} / 1000 characters
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Location & Service Area */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-semibold mb-4">Location & Service Area</h2>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Address
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => updateField('address', e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                        placeholder="123 Main St"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            City
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => updateField('city', e.target.value)}
                                            className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                            placeholder="San Francisco"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            State/Region
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.region}
                                            onChange={(e) => updateField('region', e.target.value)}
                                            className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                            placeholder="CA"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Service Radius (miles)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.serviceRadius}
                                        onChange={(e) => updateField('serviceRadius', parseInt(e.target.value))}
                                        className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                        min="0"
                                        max="500"
                                    />
                                    <p className="mt-1 text-sm text-slate-500">
                                        How far are you willing to travel for on-site support?
                                    </p>
                                </div>

                                <div>
                                    <label className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.remoteOnly}
                                            onChange={(e) => updateField('remoteOnly', e.target.checked)}
                                            className="w-4 h-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                                        />
                                        <span className="text-sm font-medium text-slate-300">
                                            Remote support only (no on-site visits)
                                        </span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Expertise */}
                        {step === 4 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-semibold mb-4">Expertise & Certifications</h2>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-3">
                                        Industries You Serve
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {INDUSTRIES.map((industry) => (
                                            <label key={industry} className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.industries.includes(industry)}
                                                    onChange={() => toggleArrayItem('industries', industry)}
                                                    className="w-4 h-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                                                />
                                                <span className="text-sm text-slate-300">{industry}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-3">
                                        Your Certifications
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {CERTIFICATIONS.map((cert) => (
                                            <label key={cert} className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.certifications.includes(cert)}
                                                    onChange={() => toggleArrayItem('certifications', cert)}
                                                    className="w-4 h-4 text-nerve border-slate-700 rounded focus:ring-nerve/50"
                                                />
                                                <span className="text-sm text-slate-300">{cert}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="mt-6 bg-health-critical/10 border border-health-critical/20 text-health-critical px-4 py-3 rounded-md">
                                {error}
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="mt-8 flex justify-between">
                            {step > 1 && (
                                <button type="button"
                                    
                                    onClick={prevStep}
                                    className="px-6 py-2 border border-slate-700 rounded-md text-slate-300 hover:bg-slate-900/30 transition"
                                >
                                    Previous
                                </button>
                            )}

                            {step < 4 ? (
                                <button type="button"
                                    
                                    onClick={nextStep}
                                    className="ml-auto px-6 py-2 bg-nerve text-white rounded-md hover:brightness-110 transition"
                                >
                                    Next
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="ml-auto px-6 py-2 bg-health-good text-white rounded-md hover:bg-health-good/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Submitting...' : 'Submit Application'}
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Info Box */}
                <div className="mt-8 bg-nerve/5 border border-nerve/20 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-nerve mb-2">What Happens Next?</h3>
                    <ol className="list-decimal list-inside space-y-2 text-nerve">
                        <li>Your application will be reviewed by our team (1-2 business days)</li>
                        <li>Once verified, you'll receive an email to take your certification exam</li>
                        <li>Pass the exam to unlock your partner dashboard</li>
                        <li>Start getting matched with workspaces and earning 50% revenue share!</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
