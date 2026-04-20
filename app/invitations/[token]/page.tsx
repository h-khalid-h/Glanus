'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { XCircle, Loader2 } from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';

// Password validation mirrors the server-side schema
function validatePassword(password: string): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Must contain at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Must contain at least one number';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Must contain at least one special character';
    return null;
}

export default function InvitationPage({ params: paramsPromise }: { params: Promise<{ token: string }> }) {
    const params = use(paramsPromise);
    const router = useRouter();
    const { data: session, status } = useSession();

    type InviteInfo = {
        inviter: { name: string };
        workspace: { name: string };
        role: string;
        email?: string;
    };

    const [inviteState, setInviteState] = useState<{
        loading: boolean;
        error: string | null;
        invite: InviteInfo | null;
    }>({
        loading: true,
        error: null,
        invite: null,
    });

    // New-user registration form state
    const [showRegister, setShowRegister] = useState(false);
    const [regName, setRegName] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regConfirm, setRegConfirm] = useState('');
    const [regError, setRegError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
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
        setIsSubmitting(true);
        try {
            const res = await csrfFetch(`/api/invitations/${params.token}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error?.message || 'Failed to accept invitation');
            }

            router.push(`/workspaces/analytics`);
        } catch (err: unknown) {
            setInviteState(prev => ({
                ...prev,
                error: err instanceof Error ? err.message : 'Failed to accept invitation'
            }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRegisterAndAccept = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegError(null);

        const pwErr = validatePassword(regPassword);
        if (pwErr) { setRegError(pwErr); return; }
        if (regPassword !== regConfirm) { setRegError('Passwords do not match'); return; }
        if (!regName.trim()) { setRegError('Name is required'); return; }

        setIsSubmitting(true);
        try {
            const res = await csrfFetch(`/api/invitations/${params.token}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: regName.trim(), password: regPassword }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error?.message || 'Failed to create account');
            }

            // Auto sign-in with new credentials
            const signInResult = await signIn('credentials', {
                redirect: false,
                email: inviteState.invite?.email,
                password: regPassword,
            });

            if (signInResult?.error) {
                // Sign-in failed but account was created — redirect to login
                router.push(`/login?message=Account created. Please sign in.`);
            } else {
                router.push(`/workspaces/analytics`);
            }
        } catch (err: unknown) {
            setRegError(err instanceof Error ? err.message : 'Failed to create account');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (inviteState.loading || status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-nerve" />
            </div>
        );
    }

    if (inviteState.error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="max-w-md w-full bg-card backdrop-blur-sm shadow-xl rounded-2xl p-8 text-center border border-border">
                    <div className="w-16 h-16 bg-health-critical/10 rounded-full flex items-center justify-center mx-auto mb-4 text-health-critical">
                        <XCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">Invitation Error</h2>
                    <p className="text-muted-foreground mb-6">{inviteState.error}</p>
                    <Button onClick={() => router.push('/')} variant="secondary" className="w-full">
                        Go Home
                    </Button>
                </div>
            </div>
        );
    }

    const { invite } = inviteState;
    if (!invite) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full bg-card backdrop-blur-sm shadow-xl rounded-2xl p-8 text-center border border-border animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-nerve/10 rounded-full flex items-center justify-center mx-auto mb-4 text-nerve">
                    <MailIcon className="w-8 h-8" />
                </div>

                <h1 className="text-2xl font-bold text-foreground mb-2">
                    You&apos;ve been invited!
                </h1>

                <p className="text-muted-foreground mb-6">
                    <span className="font-semibold text-foreground">{invite.inviter.name}</span> has invited you to join the workspace{' '}
                    <span className="font-semibold text-foreground">{invite.workspace.name}</span> as a{' '}
                    <span className="uppercase text-xs font-bold bg-muted px-1.5 py-0.5 rounded">{invite.role}</span>.
                </p>

                {!session ? (
                    /* ── Unauthenticated: show register form or sign-in options ── */
                    showRegister ? (
                        <form onSubmit={handleRegisterAndAccept} className="text-left space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Your Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={regName}
                                    onChange={(e) => setRegName(e.target.value)}
                                    placeholder="Jane Smith"
                                    className="w-full bg-muted border-border text-foreground rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={regPassword}
                                    onChange={(e) => setRegPassword(e.target.value)}
                                    placeholder="Min 8 chars, upper + lower + number + symbol"
                                    className="w-full bg-muted border-border text-foreground rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={regConfirm}
                                    onChange={(e) => setRegConfirm(e.target.value)}
                                    placeholder="Repeat password"
                                    className="w-full bg-muted border-border text-foreground rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            {regError && (
                                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                                    {regError}
                                </p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => { setShowRegister(false); setRegError(null); }}
                                >
                                    Back
                                </Button>
                                <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                                    Create Account &amp; Join
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                                Please sign in or create an account to accept this invitation.
                            </p>
                            <Button onClick={() => setShowRegister(true)} className="w-full">
                                Create Account &amp; Accept
                            </Button>
                            <Button onClick={() => signIn()} variant="secondary" className="w-full">
                                Sign In to Existing Account
                            </Button>
                        </div>
                    )
                ) : (
                    /* ── Authenticated: confirm and accept ── */
                    <div className="space-y-4">
                        <div className="bg-muted/50 p-4 rounded-xl border border-border">
                            <p className="text-sm font-medium text-muted-foreground mb-1">Signed in as</p>
                            <div className="flex items-center justify-center gap-2">
                                {(session.user as typeof session.user & { image?: string })?.image && (
                                    <Image
                                        src={(session.user as typeof session.user & { image?: string }).image!}
                                        alt="Your avatar"
                                        width={24}
                                        height={24}
                                        className="w-6 h-6 rounded-full"
                                    />
                                )}
                                <span className="text-foreground font-semibold">{session.user?.email}</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleAccept}
                            className="w-full h-12 text-base font-semibold"
                            isLoading={isSubmitting}
                        >
                            Accept Invitation
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function MailIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
    );
}
