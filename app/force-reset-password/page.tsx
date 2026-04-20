'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function ForceResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const passwordChecks = [
        { label: 'At least 8 characters', met: password.length >= 8 },
        { label: 'Passwords match', met: password.length > 0 && password === passwordConfirmation },
    ];

    const isValid = passwordChecks.every((c) => c.met);

    async function getCsrfToken(): Promise<string | null> {
        try {
            const res = await fetch('/api/csrf');
            if (!res.ok) return null;
            const data = await res.json();
            return data.token || null;
        } catch {
            return null;
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        setError('');
        setIsLoading(true);

        try {
            const csrfToken = await getCsrfToken();

            const res = await fetch('/api/auth/force-reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
                },
                credentials: 'include',
                body: JSON.stringify({ password, passwordConfirmation }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to update password');
                return;
            }

            // Password changed — redirect to dashboard (fresh token already set by API)
            window.location.assign('/dashboard');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
            {/* Background */}
            <div className="absolute inset-0 bg-grid opacity-15" />
            <div className="absolute top-0 right-1/4 w-80 h-80 rounded-full opacity-5 blur-3xl bg-primary" />
            <div className="absolute bottom-1/3 left-1/6 w-64 h-64 rounded-full opacity-4 blur-3xl bg-cortex" />

            {/* Header */}
            <header className="relative z-10 flex items-center px-6 py-5 md:px-12">
                <div className="flex items-center gap-2.5">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 6C6.134 6 3 9.134 3 13s3.134 7 7 7"
                            stroke="hsl(166, 84%, 39%)" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M22 26c3.866 0 7-3.134 7-7s-3.134-7-7-7"
                            stroke="hsl(166, 84%, 39%)" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="16" cy="16" r="2" fill="hsl(166, 84%, 39%)" opacity="0.6" />
                    </svg>
                    <span className="text-lg font-bold text-foreground">Glanus</span>
                </div>
            </header>

            {/* Main */}
            <main className="relative z-10 flex flex-1 items-center justify-center px-4">
                <div className="w-full max-w-md animate-fade-in">
                    {/* Alert banner */}
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                        <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-400">Password Reset Required</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Your administrator has reset your password. You must set a new password before continuing.
                            </p>
                        </div>
                    </div>

                    {/* Card */}
                    <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-8 shadow-xl">
                        <div className="mb-6 text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                                <Lock className="h-7 w-7 text-primary" />
                            </div>
                            <h1 className="text-2xl font-bold text-foreground">Set New Password</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Choose a strong password for your account
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* New Password */}
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                                    New Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        autoFocus
                                        autoComplete="new-password"
                                        className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label htmlFor="confirm" className="block text-sm font-medium text-foreground mb-1.5">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="confirm"
                                        type={showConfirm ? 'text' : 'password'}
                                        value={passwordConfirmation}
                                        onChange={(e) => setPasswordConfirmation(e.target.value)}
                                        placeholder="Confirm new password"
                                        autoComplete="new-password"
                                        className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                                    >
                                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Validation checklist */}
                            <div className="space-y-1.5 pt-1">
                                {passwordChecks.map(({ label, met }) => (
                                    <div key={label} className="flex items-center gap-2">
                                        <CheckCircle2
                                            className={`h-3.5 w-3.5 transition-colors ${
                                                met ? 'text-emerald-400' : 'text-muted-foreground/30'
                                            }`}
                                        />
                                        <span className={`text-xs transition-colors ${
                                            met ? 'text-emerald-400' : 'text-muted-foreground/50'
                                        }`}>
                                            {label}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={!isValid || isLoading}
                                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Updating…
                                    </>
                                ) : (
                                    <>
                                        <Lock className="h-4 w-4" />
                                        Set New Password
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <p className="mt-4 text-center text-xs text-muted-foreground/40">
                        You will be redirected to the dashboard after updating your password.
                    </p>
                </div>
            </main>
        </div>
    );
}
