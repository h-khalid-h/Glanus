'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui';

interface Assignment {
    id: string;
    status: string;
    assignedAt: string;
    acceptedAt: string | null;
    completedAt: string | null;
    revenueSplit: string;
    totalEarnings: string;
    rating: number | null;
    review: string | null;
    partner: {
        id: string;
        companyName: string;
        logo: string | null;
        certificationLevel: string;
        averageRating: string | null;
        totalReviews: number;
    };
}

export default function WorkspacePartnerPage() {
    const params = useParams();
    const { error: toastError, success: toastSuccess } = useToast();
    const router = useRouter();
    const workspaceId = params?.id as string;

    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [loading, setLoading] = useState(true);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [rating, setRating] = useState(5);
    const [review, setReview] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

    useEffect(() => {
        if (workspaceId) {
            fetchAssignment();
        }
    }, [workspaceId]);

    const fetchAssignment = async () => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/partner`);
            if (res.ok) {
                const data = await res.json();
                setAssignment(data);
            }
        } catch (err: unknown) {
            toastError('Failed to Load', err instanceof Error ? err.message : 'Could not load partner assignment');
        } finally {
            setLoading(false);
        }
    };

    const assignPartner = async () => {
        try {
            setLoading(true);
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/assign-partner`, {
                method: 'POST',
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toastSuccess('Partner Assigned', `Match score: ${data.matchScore}/100`);
            fetchAssignment();
        } catch (err: unknown) {
            toastError('Error', err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const removePartner = async () => {
        setShowRemoveConfirm(false);

        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/partner`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to remove partner');

            toastSuccess('Partner Removed', 'Partner has been removed from this workspace.');
            setAssignment(null);
        } catch (err: unknown) {
            toastError('Error', err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    const submitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/partner/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating, review }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toastSuccess('Review Submitted', 'Your review has been recorded.');
            setShowReviewForm(false);
            fetchAssignment();
        } catch (err: unknown) {
            toastError('Error', err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <PageSpinner text="Loading partner data…" />;
    }

    return (
        <>
            <ConfirmDialog
                open={showRemoveConfirm}
                title="Remove Partner"
                message="Are you sure you want to remove this partner? They will lose access to this workspace."
                confirmLabel="Remove"
                variant="danger"
                onConfirm={removePartner}
                onCancel={() => setShowRemoveConfirm(false)}
            />
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="text-nerve hover:underline mb-4"
                    >
                        ← Back to Workspace
                    </button>
                    <h1 className="text-3xl font-bold text-white">Partner Management</h1>
                </div>

                {!assignment ? (
                    /* No Partner Assigned */
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-8 text-center">
                        <div className="mb-6">
                            <div className="text-6xl mb-4">🤝</div>
                            <h2 className="text-2xl font-semibold text-white mb-2">No Partner Assigned</h2>
                            <p className="text-slate-400">
                                Get matched with a certified partner to help manage this workspace
                            </p>
                        </div>

                        <div className="mb-8 bg-nerve/5 border border-nerve/20 rounded-lg p-6">
                            <h3 className="font-semibold text-nerve mb-3">What partners provide:</h3>
                            <ul className="text-left space-y-2 text-nerve">
                                <li>✓ Proactive workspace monitoring and management</li>
                                <li>✓ 24/7 support and issue resolution</li>
                                <li>✓ Regular maintenance and optimization</li>
                                <li>✓ Expert guidance and best practices</li>
                                <li>✓ Matched based on location, industry, and rating</li>
                            </ul>
                        </div>

                        <button
                            onClick={assignPartner}
                            disabled={loading}
                            className="px-8 py-3 bg-nerve text-white rounded-md font-semibold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Finding best match...' : 'Assign Partner Now'}
                        </button>
                    </div>
                ) : (
                    /* Partner Assigned */
                    <div className="space-y-6">
                        {/* Partner Card */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-start space-x-4">
                                    {assignment.partner.logo && (
                                        <img
                                            src={assignment.partner.logo}
                                            alt={assignment.partner.companyName}
                                            className="w-16 h-16 rounded-lg object-cover"
                                        />
                                    )}
                                    <div>
                                        <h2 className="text-2xl font-semibold text-white">{assignment.partner.companyName}</h2>
                                        <div className="flex items-center space-x-3 mt-1">
                                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-semibold">
                                                {assignment.partner.certificationLevel}
                                            </span>
                                            {assignment.partner.averageRating && (
                                                <span className="text-sm text-slate-400">
                                                    ⭐ {Number(assignment.partner.averageRating).toFixed(1)} ({assignment.partner.totalReviews} reviews)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${assignment.status === 'ACCEPTED' || assignment.status === 'ACTIVE' ? 'bg-health-good/15 text-health-good' :
                                    assignment.status === 'PENDING' ? 'bg-health-warn/15 text-health-warn' :
                                        'bg-slate-800/50 text-slate-200'
                                    }`}>
                                    {assignment.status}
                                </span>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-slate-900/30 rounded-lg p-4">
                                    <p className="text-sm text-slate-400 mb-1">Assigned</p>
                                    <p className="text-lg font-semibold text-white">
                                        {new Date(assignment.assignedAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="bg-slate-900/30 rounded-lg p-4">
                                    <p className="text-sm text-slate-400 mb-1">Revenue Split</p>
                                    <p className="text-lg font-semibold text-white">
                                        {Number(assignment.revenueSplit) * 100}%
                                    </p>
                                </div>
                                <div className="bg-slate-900/30 rounded-lg p-4">
                                    <p className="text-sm text-slate-400 mb-1">Total Earnings</p>
                                    <p className="text-lg font-semibold text-health-good">
                                        ${Number(assignment.totalEarnings).toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-3">
                                <a
                                    href={`/partners/${assignment.partner.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 border border-slate-700 rounded-md hover:bg-slate-900/30 transition"
                                >
                                    View Profile
                                </a>
                                {assignment.status === 'COMPLETED' && !assignment.rating && (
                                    <button
                                        onClick={() => setShowReviewForm(!showReviewForm)}
                                        className="px-4 py-2 bg-nerve text-white rounded-md hover:brightness-110 transition"
                                    >
                                        Write Review
                                    </button>
                                )}
                                {assignment.status !== 'COMPLETED' && (
                                    <button
                                        onClick={() => setShowRemoveConfirm(true)}
                                        className="px-4 py-2 bg-destructive text-white rounded-md hover:bg-destructive/80 transition"
                                    >
                                        Remove Partner
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Review Form */}
                        {showReviewForm && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                                <h3 className="text-xl font-semibold mb-4">Write a Review</h3>
                                <form onSubmit={submitReview}>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Rating
                                        </label>
                                        <div className="flex space-x-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => setRating(star)}
                                                    className="text-3xl transition"
                                                >
                                                    {star <= rating ? '⭐' : '☆'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Review (minimum 20 characters)
                                        </label>
                                        <textarea
                                            rows={4}
                                            value={review}
                                            onChange={(e) => setReview(e.target.value)}
                                            className="w-full px-4 py-2 border border-slate-700 rounded-md focus:ring-2 focus:ring-nerve/50 focus:border-transparent"
                                            placeholder="Share your experience working with this partner..."
                                            required
                                            minLength={20}
                                            maxLength={1000}
                                        />
                                        <p className="mt-1 text-sm text-slate-500">{review.length} / 1000 characters</p>
                                    </div>
                                    <div className="flex space-x-3">
                                        <button
                                            type="submit"
                                            disabled={review.length < 20 || submitting}
                                            className="px-6 py-2 bg-health-good text-white rounded-md hover:bg-health-good/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {submitting ? 'Submitting...' : 'Submit Review'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowReviewForm(false)}
                                            className="px-6 py-2 border border-slate-700 rounded-md hover:bg-slate-900/30 transition"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Existing Review */}
                        {assignment.rating && assignment.review && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                                <h3 className="text-xl font-semibold mb-4">Your Review</h3>
                                <div className="flex mb-2">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <span key={i} className={`text-2xl ${i < assignment.rating! ? 'text-health-warn' : 'text-slate-600'}`}>
                                            ⭐
                                        </span>
                                    ))}
                                </div>
                                <p className="text-slate-300">{assignment.review}</p>
                                <p className="text-sm text-slate-500 mt-2">
                                    Submitted on {assignment.completedAt && new Date(assignment.completedAt).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
