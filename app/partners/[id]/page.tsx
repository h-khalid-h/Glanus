'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { csrfFetch } from '@/lib/api/csrfFetch';

interface Partner {
    id: string;
    companyName: string;
    bio: string | null;
    logo: string | null;
    website: string | null;
    phone: string | null;
    certificationLevel: string;
    certifiedAt: string | null;
    city: string | null;
    region: string | null;
    country: string;
    serviceRadius: number | null;
    remoteOnly: boolean;
    industries: string[];
    certifications: string[];
    languages: string[];
    averageRating: string | null;
    totalReviews: number;
    acceptingNew: boolean;
    assignments: Array<{
        rating: number;
        review: string;
        ratedAt: string;
        workspace: {
            name: string;
            logo: string | null;
        };
    }>;
}

export default function PublicPartnerProfilePage() {
    const params = useParams();
    const partnerId = params?.id as string;

    const [partner, setPartner] = useState<Partner | null>(null);
    const [ratingBreakdown, setRatingBreakdown] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (partnerId) {
            fetchPartner();
        }
    }, [partnerId]);

    const fetchPartner = async () => {
        try {
            const res = await csrfFetch(`/api/partners/${partnerId}`);
            if (!res.ok) throw new Error('Partner not found');

            const data = await res.json();
            setPartner(data.partner);
            setRatingBreakdown(data.ratingBreakdown);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <PageSpinner text="Loading partner profile…" />;
    }

    if (error || !partner) {
        return <ErrorState title="Partner Not Found" description={error || 'This partner profile could not be found.'} onRetry={() => window.location.reload()} />;
    }

    return (
        <div className="min-h-screen bg-slate-900/30">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-nerve to-nerve/70 text-white py-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-start space-x-6">
                        {partner.logo && (
                            <img
                                src={partner.logo}
                                alt={partner.companyName}
                                className="w-24 h-24 rounded-lg bg-slate-800 object-cover"
                            />
                        )}
                        <div className="flex-1">
                            <h1 className="text-4xl font-bold mb-2">{partner.companyName}</h1>
                            <div className="flex items-center space-x-4 mb-4">
                                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold">
                                    {partner.certificationLevel} Partner
                                </span>
                                {partner.averageRating && (
                                    <span className="flex items-center">
                                        ⭐ {Number(partner.averageRating).toFixed(1)} ({partner.totalReviews} reviews)
                                    </span>
                                )}
                                {partner.acceptingNew && (
                                    <span className="px-3 py-1 bg-health-good/80 rounded-full text-sm font-semibold">
                                        Accepting New Clients
                                    </span>
                                )}
                            </div>
                            <div className="text-sm space-y-1 opacity-90">
                                <p>
                                    📍 {[partner.city, partner.region, partner.country].filter(Boolean).join(', ')}
                                    {partner.remoteOnly && ' • Remote Only'}
                                </p>
                                {partner.website && (
                                    <p>
                                        🌐 <a href={partner.website} target="_blank" rel="noopener noreferrer" className="underline hover:text-white/80">
                                            {partner.website}
                                        </a>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* About */}
                        {partner.bio && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                                <h2 className="text-2xl font-semibold mb-4">About</h2>
                                <p className="text-slate-300 whitespace-pre-wrap">{partner.bio}</p>
                            </div>
                        )}

                        {/* Reviews */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <h2 className="text-2xl font-semibold mb-4">Client Reviews</h2>

                            {/* Rating Overview */}
                            {partner.averageRating && (
                                <div className="mb-6 pb-6 border-b border-slate-800">
                                    <div className="flex items-center space-x-8">
                                        <div className="text-center">
                                            <p className="text-5xl font-bold text-white">{Number(partner.averageRating).toFixed(1)}</p>
                                            <p className="text-sm text-slate-400 mt-1">out of 5</p>
                                        </div>
                                        <div className="flex-1">
                                            {[5, 4, 3, 2, 1].map((star) => {
                                                const count = ratingBreakdown[star] || 0;
                                                const percentage = partner.totalReviews > 0 ? (count / partner.totalReviews) * 100 : 0;
                                                return (
                                                    <div key={star} className="flex items-center space-x-2 mb-1">
                                                        <span className="text-sm text-slate-400 w-8">{star} ⭐</span>
                                                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-health-warn"
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm text-slate-400 w-8">{count}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Individual Reviews */}
                            {partner.assignments.length === 0 ? (
                                <p className="text-slate-400">No reviews yet</p>
                            ) : (
                                <div className="space-y-6">
                                    {partner.assignments.map((assignment, index) => (
                                        <div key={index} className="border-b border-slate-800 last:border-0 pb-6 last:pb-0">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <p className="font-semibold text-white">{assignment.workspace.name}</p>
                                                    <p className="text-sm text-slate-400">
                                                        {formatDate(assignment.ratedAt)}
                                                    </p>
                                                </div>
                                                <div className="flex">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <span key={i} className={i < assignment.rating ? 'text-health-warn' : 'text-slate-600'}>
                                                            ⭐
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-slate-300">{assignment.review}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Service Area */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <h3 className="text-lg font-semibold mb-4">Service Area</h3>
                            <div className="space-y-2 text-sm text-slate-300">
                                <p><strong>Location:</strong> {[partner.city, partner.region].filter(Boolean).join(', ') || 'Not specified'}</p>
                                {partner.serviceRadius && !partner.remoteOnly && (
                                    <p><strong>Service Radius:</strong> {partner.serviceRadius} miles</p>
                                )}
                                <p><strong>Remote Support:</strong> {partner.remoteOnly ? 'Yes (Remote Only)' : 'Available'}</p>
                            </div>
                        </div>

                        {/* Industries */}
                        {partner.industries && partner.industries.length > 0 && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                                <h3 className="text-lg font-semibold mb-4">Industries Served</h3>
                                <div className="flex flex-wrap gap-2">
                                    {partner.industries.map((industry) => (
                                        <span
                                            key={industry}
                                            className="px-3 py-1 bg-nerve/10 text-nerve rounded-full text-sm font-medium"
                                        >
                                            {industry}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Certifications */}
                        {partner.certifications && partner.certifications.length > 0 && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                                <h3 className="text-lg font-semibold mb-4">Certifications</h3>
                                <ul className="space-y-2 text-sm text-slate-300">
                                    {partner.certifications.map((cert) => (
                                        <li key={cert} className="flex items-center">
                                            <span className="text-health-good mr-2">✓</span>
                                            {cert}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Languages */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <h3 className="text-lg font-semibold mb-4">Languages</h3>
                            <div className="flex flex-wrap gap-2">
                                {partner.languages.map((lang) => (
                                    <span
                                        key={lang}
                                        className="px-3 py-1 bg-slate-800/50 text-slate-200 rounded-full text-sm"
                                    >
                                        {lang}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Contact */}
                        {partner.phone && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                                <h3 className="text-lg font-semibold mb-4">Contact</h3>
                                <p className="text-sm text-slate-300">
                                    <strong>Phone:</strong> {partner.phone}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
