'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { XCircle, Loader2 } from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';

export default function InvitationPage({ params: paramsPromise }: { params: Promise<{ token: string }> }) {
    const params = use(paramsPromise);
    const router = useRouter();
    const { data: session, status } = useSession();
    const [inviteState, setInviteState] = useState<{
        loading: boolean;
        error: string | null;
        invite: { inviter: { name: string }; workspace: { name: string }; role: string } | null;
    }>({
        loading: true,
        error: null,
        invite: null,
    });

    useEffect(() => {
        // 1. Verify token
        const verifyToken = async () => {
            try {
                const res = await csrfFetch(`/api/invitations/${params.token}`);
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error?.message || 'Invalid or expired invitation');
                }
                const data = await res.json();
                setInviteState({ loading: false, error: null, invite: data.data?.invitation });
            } catch (err: unknown) {
                setInviteState({
                    loading: false,
                    error: err instanceof Error ? err.message : 'Invalid invitation',
                    invite: null
                });
            }
        };

        verifyToken();
    }, [params.token]);

    const handleAccept = async () => {
        setInviteState(prev => ({ ...prev, loading: true }));
        try {
            const res = await csrfFetch(`/api/invitations/${params.token}/accept`, {
                method: 'POST',
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error?.message || 'Failed to accept invitation');
            }

            // Success — redirect to workspace analytics (main workspace page)
            router.push(`/workspaces/analytics`);
        } catch (err: unknown) {
            setInviteState(prev => ({
                ...prev,
                loading: false,
                error: err instanceof Error ? err.message : 'Failed to accept invitation'
            }));
        }
    };

    if (inviteState.loading || status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-midnight">
                <Loader2 className="w-8 h-8 animate-spin text-nerve" />
            </div>
        );
    }

    if (inviteState.error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-midnight p-4">
                <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-sm shadow-xl rounded-2xl p-8 text-center border border-slate-800">
                    <div className="w-16 h-16 bg-health-critical/10 rounded-full flex items-center justify-center mx-auto mb-4 text-health-critical">
                        <XCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">Invitation Error</h2>
                    <p className="text-slate-500 mb-6">{inviteState.error}</p>
                    <Button onClick={() => router.push('/')} variant="secondary" className="w-full">
                        Go Home
                    </Button>
                </div>
            </div>
        );
    }

    const { invite } = inviteState;

    if (!invite) {
        return null;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-midnight p-4">
            <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-sm shadow-xl rounded-2xl p-8 text-center border border-slate-800 animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-nerve/10 rounded-full flex items-center justify-center mx-auto mb-4 text-nerve">
                    <Mail className="w-8 h-8" />
                </div>

                <h1 className="text-2xl font-bold text-foreground mb-2">
                    You've been invited!
                </h1>

                <p className="text-slate-500 mb-6">
                    <span className="font-semibold text-white">{invite.inviter.name}</span> has invited you to join the workspace <span className="font-semibold text-white">{invite.workspace.name}</span> as a <span className="uppercase text-xs font-bold bg-slate-800 px-1.5 py-0.5 rounded">{invite.role}</span>.
                </p>

                {!session ? (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500 bg-health-warn/10 p-3 rounded-lg border border-health-warn/20">
                            Please sign in or create an account to accept this invitation.
                        </p>
                        <div className="flex gap-3">
                            <Button onClick={() => signIn()} className="flex-1">
                                Sign In
                            </Button>
                            <Button onClick={() => router.push('/signup')} variant="secondary" className="flex-1">
                                Register
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <p className="text-sm font-medium text-slate-400 mb-1">Signed in as</p>
                            <div className="flex items-center justify-center gap-2">
                                {(session.user as typeof session.user & { image?: string })?.image && <Image src={(session.user as typeof session.user & { image?: string }).image!} alt="Your avatar" width={24} height={24} className="w-6 h-6 rounded-full" />}
                                <span className="text-white font-semibold">{session.user?.email}</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleAccept}
                            className="w-full h-12 text-base font-semibold"
                            isLoading={inviteState.loading}
                        >
                            Accept Invitation
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper icon
function Mail({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
    )
}
