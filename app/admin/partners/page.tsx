'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/lib/toast';

interface Partner {
    id: string;
    companyName: string;
    status: string;
    certificationLevel: string;
    city: string | null;
    region: string | null;
    averageRating: string | null;
    totalReviews: number;
    acceptingNew: boolean;
    createdAt: string;
    user: {
        id: string;
        name: string | null;
        email: string;
    };
    _count: {
        assignments: number;
        examsCompleted: number;
    };
}

export default function AdminPartnersPage() {
    const { error: toastError, success: toastSuccess } = useToast();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [stats, setStats] = useState<Record<string, number>>({});
    const [filter, setFilter] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPartners();
    }, [filter]);

    const fetchPartners = async () => {
        try {
            const url = filter ? `/api/admin/partners?status=${filter}` : '/api/admin/partners';
            const res = await csrfFetch(url);
            const data = await res.json();

            setPartners(data.partners);
            setStats(data.stats);
        } catch (err: unknown) {
            toastError('Failed to Load', err instanceof Error ? err.message : 'Could not load partners');
        } finally {
            setLoading(false);
        }
    };

    const updatePartnerStatus = async (partnerId: string, action: string) => {
        const reason = prompt(`Enter reason for ${action}:`) || '';

        try {
            const res = await csrfFetch(`/api/admin/partners/${partnerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, reason }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toastSuccess('Success', data.message);
            fetchPartners();
        } catch (err: unknown) {
            toastError('Error', err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-midnight">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nerve"></div>
            </div>
        );
    }

    const statuses = ['PENDING', 'VERIFIED', 'ACTIVE', 'SUSPENDED', 'BANNED'];

    return (
        <div className="min-h-screen bg-slate-900/30 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Partner Management</h1>
                    <p className="text-slate-400">Manage partner applications, verifications, and status</p>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    {statuses.map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(filter === status ? '' : status)}
                            className={`p-4 rounded-lg transition ${filter === status
                                ? 'bg-nerve text-white shadow-lg'
                                : 'bg-slate-800/50 text-slate-200 hover:bg-slate-800 shadow'
                                }`}
                        >
                            <p className="text-sm font-medium mb-1">{status}</p>
                            <p className="text-2xl font-bold">{stats[status] || 0}</p>
                        </button>
                    ))}
                </div>

                {/* Partners Table */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                        <h2 className="text-xl font-semibold">
                            {filter ? `${filter} Partners` : 'All Partners'}
                        </h2>
                        {filter && (
                            <button
                                onClick={() => setFilter('')}
                                className="text-sm text-nerve hover:underline"
                            >
                                Clear filter
                            </button>
                        )}
                    </div>

                    {partners.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            No partners found{filter && ` with status ${filter}`}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-900/30">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Company</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Level</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Location</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rating</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Stats</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {partners.map((partner) => (
                                        <tr key={partner.id} className="hover:bg-slate-900/30">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <Link
                                                        href={`/partners/${partner.id}`}
                                                        className="font-medium text-white hover:text-nerve"
                                                    >
                                                        {partner.companyName}
                                                    </Link>
                                                    <p className="text-xs text-slate-500">
                                                        {new Date(partner.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm">
                                                    <p className="text-white">{partner.user.name || 'N/A'}</p>
                                                    <p className="text-slate-500">{partner.user.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${partner.status === 'ACTIVE' ? 'bg-health-good/15 text-health-good' :
                                                    partner.status === 'VERIFIED' ? 'bg-nerve/10 text-nerve' :
                                                        partner.status === 'PENDING' ? 'bg-health-warn/15 text-health-warn' :
                                                            partner.status === 'SUSPENDED' ? 'bg-orange-100 text-orange-800' :
                                                                'bg-health-critical/15 text-health-critical'
                                                    }`}>
                                                    {partner.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                                                    {partner.certificationLevel}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-400">
                                                {partner.city && partner.region ? `${partner.city}, ${partner.region}` : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {partner.averageRating ? (
                                                    <div>
                                                        <p className="font-medium text-white">
                                                            ⭐ {Number(partner.averageRating).toFixed(1)}
                                                        </p>
                                                        <p className="text-xs text-slate-500">{partner.totalReviews} reviews</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500">No reviews</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-400">
                                                <p>{partner._count.assignments} assignments</p>
                                                <p>{partner._count.examsCompleted} exams</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col space-y-1">
                                                    {partner.status === 'PENDING' && (
                                                        <button
                                                            onClick={() => updatePartnerStatus(partner.id, 'verify')}
                                                            className="text-xs px-3 py-1 bg-nerve text-white rounded hover:brightness-110 transition"
                                                        >
                                                            Verify
                                                        </button>
                                                    )}
                                                    {partner.status === 'VERIFIED' && (
                                                        <button
                                                            onClick={() => updatePartnerStatus(partner.id, 'activate')}
                                                            className="text-xs px-3 py-1 bg-health-good text-white rounded hover:bg-health-good/80 transition"
                                                        >
                                                            Activate
                                                        </button>
                                                    )}
                                                    {partner.status === 'ACTIVE' && (
                                                        <button
                                                            onClick={() => updatePartnerStatus(partner.id, 'suspend')}
                                                            className="text-xs px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition"
                                                        >
                                                            Suspend
                                                        </button>
                                                    )}
                                                    {partner.status === 'SUSPENDED' && (
                                                        <button
                                                            onClick={() => updatePartnerStatus(partner.id, 'unsuspend')}
                                                            className="text-xs px-3 py-1 bg-health-good text-white rounded hover:bg-health-good/80 transition"
                                                        >
                                                            Unsuspend
                                                        </button>
                                                    )}
                                                    {partner.status !== 'BANNED' && (
                                                        <button
                                                            onClick={() => updatePartnerStatus(partner.id, 'ban')}
                                                            className="text-xs px-3 py-1 bg-destructive text-white rounded hover:bg-destructive/80 transition"
                                                        >
                                                            Ban
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
