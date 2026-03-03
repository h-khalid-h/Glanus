'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatDate, formatDateTime } from '@/lib/utils';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/lib/toast';

interface Partner {
    id: string;
    companyName: string;
    certificationLevel: string;
    status: string;
    totalEarnings: string;
    averageRating: string | null;
    totalReviews: number;
    maxWorkspaces: number;
    availableSlots: number;
    acceptingNew: boolean;
}

interface Assignment {
    id: string;
    status: string;
    assignedAt: string;
    totalEarnings: string;
    workspace: {
        id: string;
        name: string;
        slug: string;
        logo: string | null;
    };
}

interface Exam {
    id: string;
    level: string;
    status: string;
    score: number;
    completedAt: string | null;
}

function PartnerDashboardContent() {
    const { error: showError, success: showSuccess } = useToast();
    const router = useRouter();
    const { data: session, status } = useSession();
    const searchParams = useSearchParams();
    const showWelcome = searchParams?.get('welcome') === 'true';

    const [partner, setPartner] = useState<Partner | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated') {
            fetchDashboardData();
        }
    }, [status]);

    const fetchDashboardData = async () => {
        try {
            // Fetch partner profile
            const profileRes = await csrfFetch('/api/partners/me');
            if (!profileRes.ok) throw new Error('Failed to load partner profile');
            const profileData = await profileRes.json();
            setPartner(profileData.partner);

            // Fetch assignments
            const assignmentsRes = await csrfFetch('/api/partners/assignments');
            if (assignmentsRes.ok) {
                const assignData = await assignmentsRes.json();
                setAssignments(assignData.assignments);
            }

            // Fetch exam history
            const examsRes = await csrfFetch('/api/partners/exam/history');
            if (examsRes.ok) {
                const examsData = await examsRes.json();
                setExams(examsData.exams);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleAssignmentAction = async (assignmentId: string, action: 'accept' | 'reject') => {
        try {
            const res = await csrfFetch(`/api/partners/assignments/${assignmentId}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    action === 'reject' ? { reason: 'Not a good fit at this time' } : {}
                ),
            });

            if (!res.ok) throw new Error(`Failed to ${action} assignment`);

            // Refresh dashboard
            fetchDashboardData();
        } catch (err: unknown) {
            showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    if (loading) {
        return <PageSpinner text="Loading dashboard…" />;
    }

    if (error || !partner) {
        return <ErrorState title="Partner profile not found" description={error || 'No partner profile found. Please create one to get started.'} onRetry={() => window.location.reload()} />;
    }

    const pendingAssignments = assignments.filter((a) => a.status === 'PENDING');
    const activeAssignments = assignments.filter((a) => a.status === 'ACCEPTED' || a.status === 'ACTIVE');

    const certificationLevels = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
    const currentLevelIndex = certificationLevels.indexOf(partner.certificationLevel);
    const nextLevel = certificationLevels[currentLevelIndex + 1];

    return (
        <div className="py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                {/* Welcome Banner */}
                {showWelcome && (
                    <div className="mb-8 bg-health-good/10 border border-health-good/20 rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-health-good mb-2">Welcome to Glanus Partners! 🎉</h2>
                        <p className="text-health-good">
                            Your application has been submitted. Our team will review it within 1-2 business days.
                        </p>
                    </div>
                )}

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">{partner.companyName}</h1>
                    <div className="flex items-center space-x-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${partner.status === 'ACTIVE' ? 'bg-health-good/15 text-health-good' :
                            partner.status === 'VERIFIED' ? 'bg-nerve/10 text-nerve' :
                                partner.status === 'PENDING' ? 'bg-health-warn/15 text-health-warn' :
                                    'bg-slate-800/50 text-slate-200'
                            }`}>
                            {partner.status}
                        </span>
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                            {partner.certificationLevel}
                        </span>
                        {partner.averageRating && (
                            <span className="flex items-center text-sm text-slate-400">
                                ⭐ {Number(partner.averageRating).toFixed(1)} ({partner.totalReviews} reviews)
                            </span>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                        <p className="text-sm text-slate-400 mb-1">Total Earnings</p>
                        <p className="text-3xl font-bold text-white">${Number(partner.totalEarnings).toFixed(2)}</p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                        <p className="text-sm text-slate-400 mb-1">Active Workspaces</p>
                        <p className="text-3xl font-bold text-white">{activeAssignments.length}</p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                        <p className="text-sm text-slate-400 mb-1">Available Capacity</p>
                        <p className="text-3xl font-bold text-white">
                            {partner.availableSlots} / {partner.maxWorkspaces}
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                        <p className="text-sm text-slate-400 mb-1">Pending Requests</p>
                        <p className="text-3xl font-bold text-white">{pendingAssignments.length}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Pending Assignments */}
                        {pendingAssignments.length > 0 && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                                <h2 className="text-xl font-semibold mb-4">Pending Workspace Requests</h2>
                                <div className="space-y-4">
                                    {pendingAssignments.map((assignment) => (
                                        <div key={assignment.id} className="border border-slate-800 rounded-lg p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h3 className="font-semibold text-white">{assignment.workspace.name}</h3>
                                                    <p className="text-sm text-slate-400">
                                                        Requested {formatDate(assignment.assignedAt)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={() => handleAssignmentAction(assignment.id, 'accept')}
                                                    className="px-4 py-2 bg-health-good text-white rounded-md hover:bg-health-good/80 transition text-sm"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => handleAssignmentAction(assignment.id, 'reject')}
                                                    className="px-4 py-2 bg-destructive text-white rounded-md hover:bg-destructive/80 transition text-sm"
                                                >
                                                    Decline
                                                </button>
                                                <Link
                                                    href={`/workspaces/${assignment.workspace.id}`}
                                                    className="px-4 py-2 border border-slate-700 rounded-md hover:bg-slate-900/30 transition text-sm"
                                                >
                                                    View Details
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Active Workspaces */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <h2 className="text-xl font-semibold mb-4">Active Workspaces</h2>
                            {activeAssignments.length === 0 ? (
                                <p className="text-slate-400">No active workspaces yet. Accept pending requests to get started!</p>
                            ) : (
                                <div className="space-y-3">
                                    {activeAssignments.map((assignment) => (
                                        <Link
                                            key={assignment.id}
                                            href={`/workspaces/${assignment.workspace.id}`}
                                            className="block border border-slate-800 rounded-lg p-4 hover:bg-slate-900/30 transition"
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h3 className="font-semibold text-white">{assignment.workspace.name}</h3>
                                                    <p className="text-sm text-slate-400">Status: {assignment.status}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-semibold text-health-good">
                                                        ${Number(assignment.totalEarnings).toFixed(2)}
                                                    </p>
                                                    <p className="text-xs text-slate-500">Total earned</p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Certification Card */}
                        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg shadow p-6 text-white">
                            <h3 className="text-lg font-semibold mb-3">Certification</h3>
                            <div className="mb-4">
                                <p className="text-sm opacity-90 mb-2">Current Level</p>
                                <p className="text-3xl font-bold">{partner.certificationLevel}</p>
                            </div>
                            {nextLevel ? (
                                <>
                                    <p className="text-sm opacity-90 mb-3">
                                        Upgrade to {nextLevel} to unlock {
                                            nextLevel === 'SILVER' ? '50' :
                                                nextLevel === 'GOLD' ? '200' :
                                                    '1000'
                                        } workspace capacity
                                    </p>
                                    <Link
                                        href="/partners/certification"
                                        className="block w-full bg-slate-800/50 text-slate-200 text-center py-2 rounded-md font-semibold hover:bg-slate-800/50 transition"
                                    >
                                        Take {nextLevel} Exam
                                    </Link>
                                </>
                            ) : (
                                <p className="text-sm opacity-90">You've reached the highest level! 🎉</p>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                            <div className="space-y-3">
                                <Link
                                    href="/partners/earnings"
                                    className="block w-full px-4 py-2 bg-nerve text-white rounded-md text-center hover:brightness-110 transition"
                                >
                                    View Earnings
                                </Link>
                                <Link
                                    href="/partners/me"
                                    className="block w-full px-4 py-2 border border-slate-700 rounded-md text-center hover:bg-slate-900/30 transition"
                                >
                                    Edit Profile
                                </Link>
                                <button
                                    onClick={() => setPartner({ ...partner, acceptingNew: !partner.acceptingNew })}
                                    className={`block w-full px-4 py-2 rounded-md text-center transition ${partner.acceptingNew
                                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        : 'bg-health-good text-white hover:bg-health-good/80'
                                        }`}
                                >
                                    {partner.acceptingNew ? 'Pause New Requests' : 'Accept New Requests'}
                                </button>
                            </div>
                        </div>

                        {/* Exam History */}
                        {exams.length > 0 && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                                <h3 className="text-lg font-semibold mb-4">Recent Exams</h3>
                                <div className="space-y-2">
                                    {exams.slice(0, 3).map((exam) => (
                                        <div key={exam.id} className="text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-300">{exam.level}</span>
                                                <span className={`font-semibold ${exam.status === 'PASSED' ? 'text-health-good' : 'text-health-critical'
                                                    }`}>
                                                    {exam.status} ({exam.score}%)
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PartnerDashboardPage() {
    return (
        <Suspense fallback={<PageSpinner text="Loading dashboard…" />}>
            <PartnerDashboardContent />
        </Suspense>
    );
}
