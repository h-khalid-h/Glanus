'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { csrfFetch } from '@/lib/api/csrfFetch';

export default function ResetPasswordPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);
        try {
            const res = await csrfFetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to reset password');
                return;
            }

            setSuccess(true);

            // Redirect to login after 3s
            setTimeout(() => router.push('/login'), 3000);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-grid opacity-30" />
                <div className="relative z-10 text-center max-w-md p-8">
                    <h1 className="text-2xl font-bold text-foreground mb-4">Invalid Reset Link</h1>
                    <p className="text-muted-foreground mb-6">This password reset link is invalid or has expired.</p>
                    <Link href="/forgot-password" className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold">
                        Request New Link
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
            <div className="absolute inset-0 bg-grid opacity-30" />
            <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full opacity-8 blur-3xl bg-oracle" />

            <header className="relative z-10 flex items-center justify-between px-6 py-4 md:px-12">
                <Link href="/" className="flex items-center gap-2">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 6C6.134 6 3 9.134 3 13s3.134 7 7 7"
                            stroke="hsl(166, 84%, 39%)" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M22 26c3.866 0 7-3.134 7-7s-3.134-7-7-7"
                            stroke="hsl(166, 84%, 39%)" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="16" cy="16" r="2" fill="hsl(166, 84%, 39%)" opacity="0.6" />
                    </svg>
                    <span className="text-lg font-semibold text-foreground">Glanus</span>
                </Link>
            </header>

            <main className="relative z-10 flex flex-1 items-center justify-center px-4">
                <div className="w-full max-w-md animate-fade-in">
                    <div className="mb-8 text-center">
                        <h1 className="mb-2 text-3xl font-bold text-foreground">Set New Password</h1>
                        <p className="text-muted-foreground">
                            {success ? 'Your password has been reset' : 'Enter your new password below'}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-card backdrop-blur-xl p-8 shadow-2xl">
                        {success ? (
                            <div className="text-center py-4">
                                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-health-good/10">
                                    <svg className="h-7 w-7 text-health-good" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-foreground mb-1">
                                    Password reset successfully! Redirecting to sign in...
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                                        New Password
                                    </label>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Min. 8 characters"
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-foreground
                                                   placeholder:text-muted-foreground transition-all duration-200
                                                   focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-foreground">
                                        Confirm Password
                                    </label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter your password"
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-foreground
                                                   placeholder:text-muted-foreground transition-all duration-200
                                                   focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-foreground
                                               transition-all duration-200 hover:brightness-110 hover:shadow-lg hover:shadow-primary/20
                                               disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                                                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                                            </svg>
                                            Resetting…
                                        </span>
                                    ) : 'Reset Password'}
                                </button>
                            </form>
                        )}
                    </div>

                    <p className="mt-6 text-center text-sm text-muted-foreground">
                        Remember your password?{' '}
                        <Link href="/login" className="text-primary hover:text-primary/80 transition-colors">
                            Sign in →
                        </Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
