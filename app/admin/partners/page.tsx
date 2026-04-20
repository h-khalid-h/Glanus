'use client';
import { formatDate } from '@/lib/utils';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/lib/toast';
import { ErrorState, EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';

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
    const { error: showError, success: showSuccess } = useToast();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [stats, setStats] = useState<Record<string, number>>({});
    const [filter, setFilter] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        fetchPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    const fetchPartners = async () => {
        try {
            const url = filter ? `/api/admin/partners?status=${filter}` : '/api/admin/partners';
            const res = await csrfFetch(url);
            const data = await res.json();

            setPartners(data.partners);
            setStats(data.stats);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Could not load partners';
            showError('Failed to Load', msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const updatePartnerStatus = async (partnerId: string, action: string) => {
        const reason = prompt(`Enter reason for ${action}:`) || '';

        setActionLoading(partnerId);
        try {
            const res = await csrfFetch(`/api/admin/partners/${partnerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, reason }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showSuccess('Success', data.message);
            fetchPartners();
        } catch (err: unknown) {
            showError('Error', err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <PageSpinner />
        );
    }

    if (error) {
        return <ErrorState title="Failed to load partners" description={error} onRetry={() => { setError(null); setLoading(true); fetchPartners(); }} />;
    }

    const statuses = ['PENDING', 'VERIFIED', 'ACTIVE', 'SUSPENDED', 'BANNED'];

    return (
        <>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">Partner Management</h1>
                    <p className="text-muted-foreground">Manage partner applications, verifications, and status</p>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    {statuses.map((status) => (
                        <button type="button"
                            key={status}
                            onClick={() => setFilter(filter === status ? '' : status)}
                            className={`p-4 rounded-xl transition ${filter === status
                                ? 'bg-primary text-foreground shadow-lg'
                                : 'bg-muted/50 text-foreground hover:bg-muted shadow'
                                }`}
                        >
                            <p className="text-sm font-medium mb-1">{status}</p>
                            <p className="text-2xl font-bold">{stats[status] || 0}</p>
                        </button>
                    ))}
                </div>

                {/* Partners Table */}
                <div className="rounded-xl border border-border bg-card backdrop-blur-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                        <h2 className="text-xl font-semibold">
                            {filter ? `${filter} Partners` : 'All Partners'}
                        </h2>
                        {filter && (
                            <button type="button"
                                onClick={() => setFilter('')}
                                className="text-sm text-primary hover:underline"
                            >
                                Clear filter
                            </button>
                        )}
                    </div>

                    {partners.length === 0 ? (
                        <EmptyState
                            icon="🤝"
                            title={filter ? `No partners with status ${filter}` : 'No partners found'}
                            description={filter ? 'Try adjusting your filter.' : 'Partners will appear here once they sign up.'}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/30">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Company</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Level</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Location</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Rating</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Stats</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {partners.map((partner) => (
                                        <tr key={partner.id} className="hover:bg-muted/30">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <Link
                                                        href={`/partners/${partner.id}`}
                                                        className="font-medium text-foreground hover:text-primary"
                                                    >
                                                        {partner.companyName}
                                                    </Link>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDate(partner.createdAt)}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm">
                                                    <p className="text-foreground">{partner.user.name || 'N/A'}</p>
                                                    <p className="text-muted-foreground">{partner.user.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${partner.status === 'ACTIVE' ? 'bg-health-good/15 text-health-good' :
                                                    partner.status === 'VERIFIED' ? 'bg-primary/10 text-primary' :
                                                        partner.status === 'PENDING' ? 'bg-health-warn/15 text-health-warn' :
                                                            partner.status === 'SUSPENDED' ? 'bg-orange-500/15 text-orange-400' :
                                                                'bg-destructive/15 text-destructive'
                                                    }`}>
                                                    {partner.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-purple-500/15 text-purple-400 rounded text-xs font-semibold">
                                                    {partner.certificationLevel}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-muted-foreground">
                                                {partner.city && partner.region ? `${partner.city}, ${partner.region}` : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {partner.averageRating ? (
                                                    <div>
                                                        <p className="font-medium text-foreground">
                                                            ⭐ {Number(partner.averageRating).toFixed(1)}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">{partner.totalReviews} reviews</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">No reviews</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-muted-foreground">
                                                <p>{partner._count.assignments} assignments</p>
                                                <p>{partner._count.examsCompleted} exams</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col space-y-1">
                                                    {partner.status === 'PENDING' && (
                                                        <button type="button"
                                                            onClick={() => updatePartnerStatus(partner.id, 'verify')}
                                                            disabled={actionLoading === partner.id}
                                                            className="text-xs px-3 py-1 bg-primary text-foreground rounded hover:brightness-110 transition disabled:opacity-50"
                                                        >
                                                            {actionLoading === partner.id ? '…' : 'Verify'}
                                                        </button>
                                                    )}
                                                    {partner.status === 'VERIFIED' && (
                                                        <button type="button"
                                                            onClick={() => updatePartnerStatus(partner.id, 'activate')}
                                                            disabled={actionLoading === partner.id}
                                                            className="text-xs px-3 py-1 bg-health-good text-foreground rounded hover:bg-health-good/80 transition disabled:opacity-50"
                                                        >
                                                            {actionLoading === partner.id ? '…' : 'Activate'}
                                                        </button>
                                                    )}
                                                    {partner.status === 'ACTIVE' && (
                                                        <button type="button"
                                                            onClick={() => updatePartnerStatus(partner.id, 'suspend')}
                                                            disabled={actionLoading === partner.id}
                                                            className="text-xs px-3 py-1 bg-orange-600 text-foreground rounded hover:bg-orange-700 transition disabled:opacity-50"
                                                        >
                                                            {actionLoading === partner.id ? '…' : 'Suspend'}
                                                        </button>
                                                    )}
                                                    {partner.status === 'SUSPENDED' && (
                                                        <button type="button"
                                                            onClick={() => updatePartnerStatus(partner.id, 'unsuspend')}
                                                            disabled={actionLoading === partner.id}
                                                            className="text-xs px-3 py-1 bg-health-good text-foreground rounded hover:bg-health-good/80 transition disabled:opacity-50"
                                                        >
                                                            {actionLoading === partner.id ? '…' : 'Unsuspend'}
                                                        </button>
                                                    )}
                                                    {partner.status !== 'BANNED' && (
                                                        <button type="button"
                                                            onClick={() => updatePartnerStatus(partner.id, 'ban')}
                                                            disabled={actionLoading === partner.id}
                                                            className="text-xs px-3 py-1 bg-destructive text-foreground rounded hover:bg-destructive/80 transition disabled:opacity-50"
                                                        >
                                                            {actionLoading === partner.id ? '…' : 'Ban'}
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
        </>
    );
}
