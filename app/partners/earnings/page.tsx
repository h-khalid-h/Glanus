'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useToast } from '@/lib/toast';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EarningsSummary {
    totalEarnings: string;
    currentMonthEstimate: number;
    activeWorkspaces: number;
    totalWorkspaces: number;
    certificationLevel: string;
    maxWorkspaces: number;
    availableSlots: number;
}

interface TopWorkspace {
    workspace: {
        id: string;
        name: string;
        slug: string;
        logo: string | null;
    };
    totalEarnings: string;
    status: string;
    assignedAt: string;
}

interface Payout {
    id: string;
    amount: string;
    currency: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    stripePayoutId: string | null;
    failureReason: string | null;
    workspaceCount: number;
    createdAt: string;
    paidAt: string | null;
}

export default function PartnerEarningsPage() {
    const { error: showError } = useToast();
    const [summary, setSummary] = useState<EarningsSummary | null>(null);
    const [topWorkspaces, setTopWorkspaces] = useState<TopWorkspace[]>([]);
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [payoutStats, setPayoutStats] = useState<{ totalPaid: number; pending: number; failed: number; total: number } | null>(null);
    const [stripeConnected, setStripeConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchEarnings();
        fetchPayouts();
    }, []);

    const fetchEarnings = async () => {
        try {
            const res = await csrfFetch('/api/partners/earnings');
            const data = await res.json();

            setSummary(data.summary);
            setTopWorkspaces(data.topWorkspaces);
            setStripeConnected(data.stripeConnected);
        } catch (err: unknown) {
            showError('Failed to load earnings:', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const fetchPayouts = async () => {
        try {
            const res = await csrfFetch('/api/partners/payouts');
            const data = await res.json();

            setPayouts(data.payouts);
            setPayoutStats(data.stats);
        } catch (err: unknown) {
            showError('Failed to load payouts:', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    const connectStripe = async () => {
        try {
            const res = await csrfFetch('/api/partners/stripe/onboard', { method: 'POST' });
            const data = await res.json();

            if (!res.ok) {
                showError(data.error || 'Failed to start Stripe onboarding');
                return;
            }

            if (data.alreadyOnboarded) {
                setStripeConnected(true);
                return;
            }

            // Redirect to Stripe's hosted onboarding flow
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err: unknown) {
            showError('Failed to connect Stripe. Please try again.');
        }
    };

    if (loading) {
        return <PageSpinner text="Loading earnings…" />;
    }


    if (error) return <ErrorState title="Something went wrong" description={error} onRetry={() => window.location.reload()} />;

    return (
        <div className="py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Earnings & Payouts</h1>
                    <p className="text-slate-400">Track your revenue, top-performing workspaces, and payout history</p>
                </div>

                {/* Stripe Connect Banner */}
                {!stripeConnected && (
                    <div className="mb-8 bg-health-warn/10 border border-health-warn/20 rounded-lg p-6">
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="ml-3 flex-1">
                                <h3 className="text-lg font-semibold text-health-warn mb-2">Connect Stripe to Receive Payouts</h3>
                                <p className="text-health-warn mb-4">
                                    You need to connect your Stripe account to receive payouts. It only takes a few minutes!
                                </p>
                                <button
                                    onClick={connectStripe}
                                    className="px-6 py-2 bg-yellow-600 text-white rounded-md font-semibold hover:bg-yellow-700 transition"
                                >
                                    Connect Stripe Account
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Cards */}
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <p className="text-sm text-slate-400 mb-1">Total Earnings</p>
                            <p className="text-3xl font-bold text-white">${Number(summary.totalEarnings).toFixed(2)}</p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <p className="text-sm text-slate-400 mb-1">This Month (Est.)</p>
                            <p className="text-3xl font-bold text-health-good">${summary.currentMonthEstimate.toFixed(2)}</p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <p className="text-sm text-slate-400 mb-1">Active Workspaces</p>
                            <p className="text-3xl font-bold text-white">{summary.activeWorkspaces}</p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <p className="text-sm text-slate-400 mb-1">Capacity Used</p>
                            <p className="text-3xl font-bold text-white">
                                {summary.maxWorkspaces - summary.availableSlots} / {summary.maxWorkspaces}
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Top Earning Workspaces */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                        <h2 className="text-xl font-semibold mb-4">Top Earning Workspaces</h2>
                        {topWorkspaces.length === 0 ? (
                            <p className="text-slate-400">No workspace assignments yet</p>
                        ) : (
                            <div className="space-y-4">
                                {topWorkspaces.map((item, index) => (
                                    <div key={item.workspace.id} className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-nerve/10 text-nerve font-semibold flex items-center justify-center text-sm">
                                                #{index + 1}
                                            </div>
                                            <div>
                                                <Link
                                                    href={`/workspaces/${item.workspace.id}`}
                                                    className="font-medium text-white hover:text-nerve"
                                                >
                                                    {item.workspace.name}
                                                </Link>
                                                <p className="text-xs text-slate-400">
                                                    Since {formatDate(item.assignedAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-health-good">${Number(item.totalEarnings).toFixed(2)}</p>
                                            <p className="text-xs text-slate-400">{item.status}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Payout Summary */}
                    {payoutStats && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <h2 className="text-xl font-semibold mb-4">Payout Summary</h2>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                                    <span className="text-slate-400">Total Paid Out</span>
                                    <span className="text-xl font-bold text-health-good">${payoutStats.totalPaid.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                                    <span className="text-slate-400">Pending Payouts</span>
                                    <span className="text-xl font-bold text-yellow-600">${payoutStats.pending.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                                    <span className="text-slate-400">Failed Payouts</span>
                                    <span className="text-xl font-bold text-health-critical">{payoutStats.failed}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Total Payouts</span>
                                    <span className="text-xl font-bold text-white">{payoutStats.total}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Payout History */}
                <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                    <div className="p-6 border-b border-slate-800">
                        <h2 className="text-xl font-semibold">Payout History</h2>
                    </div>
                    <div className="overflow-x-auto">
                        {payouts.length === 0 ? (
                            <div className="p-6 text-center text-slate-400">
                                No payouts yet. Payouts are processed monthly after your first month of earnings.
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-900/30">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Period</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Workspaces</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {payouts.map((payout) => (
                                        <tr key={payout.id} className="hover:bg-slate-900/30">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                                {formatDate(payout.periodStart)} -{' '}
                                                {formatDate(payout.periodEnd)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-lg font-semibold text-white">
                                                    ${Number(payout.amount).toFixed(2)} {payout.currency}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${payout.status === 'PAID' ? 'bg-health-good/15 text-health-good' :
                                                    payout.status === 'PENDING' ? 'bg-health-warn/15 text-health-warn' :
                                                        payout.status === 'PROCESSING' ? 'bg-nerve/10 text-nerve' :
                                                            'bg-health-critical/15 text-health-critical'
                                                    }`}>
                                                    {payout.status}
                                                </span>
                                                {payout.failureReason && (
                                                    <p className="text-xs text-health-critical mt-1">{payout.failureReason}</p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                                {payout.workspaceCount}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                                {payout.paidAt
                                                    ? formatDate(payout.paidAt)
                                                    : formatDate(payout.createdAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-8 bg-nerve/5 border border-nerve/20 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-nerve mb-2">How Payouts Work</h3>
                    <ul className="list-disc list-inside space-y-1 text-nerve">
                        <li>Payouts are processed monthly on the 1st of each month</li>
                        <li>You earn 50% revenue share from each workspace subscription</li>
                        <li>Funds are transferred to your Stripe Connect account within 2-3 business days</li>
                        <li>You can track pending and completed payouts in this dashboard</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
