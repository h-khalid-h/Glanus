'use client';

/**
 * /accept-invite?token=XYZ
 *
 * Alternative entry-point for the invitation flow.
 * Reads the token from the query string and renders the same accept experience
 * as /invitations/[token], supporting both existing and new-user flows.
 */

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Image from 'next/image';
import { Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { csrfFetch } from '@/lib/api/csrfFetch';

function validatePassword(password: string): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Must contain at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Must contain at least one number';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Must contain at least one special character';
    return null;
}

type InviteInfo = {
    inviter: { name: string; email: string };
    workspace: { name: string };
    role: string;
    email: string;
    expiresAt: string;
};

function AcceptInviteContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const { data: session, status } = useSession();

    const [state, setState] = useState<{
        loading: boolean;
        error: string | null;
        invite: InviteInfo | null;
    }>({ loading: true, error: null, invite: null });

    const [showRegister, setShowRegister] = useState(false);
    const [regName, setRegName] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regConfirm, setRegConfirm] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!token) {
            setState({ loading: false, error: 'No invitation token provided.', invite: null });
            return;
        }

        csrfFetch(`/api/invitations/${token}`)
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message || 'Invalid or expired invitation');
                setState({ loading: false, error: null, invite: data.data?.invitation });
            })
            .catch((err: unknown) => {
                setState({
                    loading: false,
                    error: err instanceof Error ? err.message : 'Invalid invitation',
                    invite: null,
                });
            });
    }, [token]);

    const handleAccept = async () => {
        if (!token) return;
        setIsSubmitting(true);
        try {
            const res = await csrfFetch(`/api/invitations/${token}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Failed to accept invitation');
            router.push('/workspaces/analytics');
        } catch (err: unknown) {
            setState((prev) => ({
                ...prev,
                error: err instanceof Error ? err.message : 'Failed to accept invitation',
            }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRegisterAndAccept = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        setFormError(null);

        const pwErr = validatePassword(regPassword);
        if (pwErr) { setFormError(pwErr); return; }
        if (regPassword !== regConfirm) { setFormError('Passwords do not match'); return; }
        if (!regName.trim()) { setFormError('Name is required'); return; }

        setIsSubmitting(true);
        try {
            const res = await csrfFetch(`/api/invitations/${token}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: regName.trim(), password: regPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Failed to create account');

            // Auto sign-in with new credentials
            const signInResult = await signIn('credentials', {
                redirect: false,
                email: state.invite?.email,
                password: regPassword,
            });

            if (signInResult?.error) {
                router.push('/login?message=Account+created.+Please+sign+in.');
            } else {
                router.push('/workspaces/analytics');
            }
        } catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : 'Failed to create account');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (state.loading || status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="max-w-md w-full bg-card shadow-xl rounded-2xl p-8 text-center border border-border">
                    <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4 text-destructive">
                        <XCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">Invitation Error</h2>
                    <p className="text-muted-foreground mb-6">{state.error}</p>
                    <Button onClick={() => router.push('/')} variant="secondary" className="w-full">
                        Go to Homepage
                    </Button>
                </div>
            </div>
        );
    }

    const { invite } = state;
    if (!invite) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full bg-card shadow-xl rounded-2xl p-8 border border-border">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                        <MailIcon className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">Workspace Invitation</h1>
                    <p className="text-muted-foreground text-sm">
                        <span className="font-semibold text-foreground">{invite.inviter.name || invite.inviter.email}</span> invited you to join{' '}
                        <span className="font-semibold text-foreground">{invite.workspace.name}</span>
                    </p>
                    <span className="mt-2 inline-block uppercase text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {invite.role}
                    </span>
                </div>

                {!session ? (
                    showRegister ? (
                        /* ── New user registration form ── */
                        <form onSubmit={handleRegisterAndAccept} className="space-y-4">
                            <p className="text-sm text-muted-foreground text-center mb-2">
                                Creating account for <span className="font-medium text-foreground">{invite.email}</span>
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={regName}
                                    onChange={(e) => setRegName(e.target.value)}
                                    placeholder="Jane Smith"
                                    className="w-full bg-muted border border-border text-foreground rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={regPassword}
                                    onChange={(e) => setRegPassword(e.target.value)}
                                    placeholder="8+ chars, upper + lower + number + symbol"
                                    className="w-full bg-muted border border-border text-foreground rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    value={regConfirm}
                                    onChange={(e) => setRegConfirm(e.target.value)}
                                    placeholder="Repeat password"
                                    className="w-full bg-muted border border-border text-foreground rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            {formError && (
                                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                                    {formError}
                                </p>
                            )}

                            <div className="flex gap-3 pt-1">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => { setShowRegister(false); setFormError(null); }}
                                >
                                    Back
                                </Button>
                                <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                                    Create Account &amp; Join
                                </Button>
                            </div>
                        </form>
                    ) : (
                        /* ── Unauthenticated: choose flow ── */
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground text-center bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                                Sign in or create a new account to accept this invitation.
                            </p>
                            <Button onClick={() => setShowRegister(true)} className="w-full">
                                Create Account &amp; Accept Invitation
                            </Button>
                            <Button onClick={() => signIn()} variant="secondary" className="w-full">
                                Sign In to Existing Account
                            </Button>
                        </div>
                    )
                ) : (
                    /* ── Authenticated: confirm join ── */
                    <div className="space-y-4">
                        <div className="bg-muted/50 p-4 rounded-xl border border-border text-center">
                            <p className="text-sm font-medium text-muted-foreground mb-1">Signed in as</p>
                            <div className="flex items-center justify-center gap-2">
                                {(session.user as typeof session.user & { image?: string })?.image && (
                                    <Image
                                        src={(session.user as typeof session.user & { image?: string }).image!}
                                        alt="Avatar"
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
                            Accept Invitation &amp; Join Workspace
                        </Button>
                    </div>
                )}

                {/* Expiry notice */}
                <p className="text-xs text-muted-foreground text-center mt-4">
                    This invitation expires on{' '}
                    {new Date(invite.expiresAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </p>
            </div>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            }
        >
            <AcceptInviteContent />
        </Suspense>
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
