'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/lib/toast';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { error: showError } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (res.ok) {
                setSubmitted(true);
            } else {
                const data = await res.json();
                showError('Request Failed', data.error || 'Something went wrong. Please try again.');
            }
        } catch {
            showError('Network Error', 'Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-midnight relative overflow-hidden flex flex-col">
            <div className="absolute inset-0 bg-grid opacity-30" />
            <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full opacity-8 blur-3xl bg-oracle" />

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between px-6 py-4 md:px-12">
                <Link href="/" className="flex items-center gap-2">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 6C6.134 6 3 9.134 3 13s3.134 7 7 7"
                            stroke="hsl(168, 100%, 45%)" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M22 26c3.866 0 7-3.134 7-7s-3.134-7-7-7"
                            stroke="hsl(168, 100%, 45%)" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="16" cy="16" r="2" fill="hsl(168, 100%, 45%)" opacity="0.6" />
                    </svg>
                    <span className="text-lg font-semibold text-white">Glanus</span>
                </Link>
            </header>

            <main className="relative z-10 flex flex-1 items-center justify-center px-4">
                <div className="w-full max-w-md animate-fade-in">
                    <div className="mb-8 text-center">
                        <h1 className="mb-2 text-3xl font-bold text-white">Reset Password</h1>
                        <p className="text-slate-400">
                            {submitted
                                ? 'Check your email for a reset link'
                                : 'Enter your email to receive a reset link'}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl">
                        {submitted ? (
                            <div className="text-center py-4">
                                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-nerve/10">
                                    <svg className="h-7 w-7 text-nerve" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                    </svg>
                                </div>
                                <p className="text-sm text-slate-300 mb-1">
                                    If an account exists for <strong className="text-white">{email}</strong>, you&apos;ll receive a reset link shortly.
                                </p>
                                <p className="text-xs text-slate-500 mt-3">
                                    Didn&apos;t receive it? Check your spam folder or try again.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        required
                                        autoComplete="email"
                                        className="w-full rounded-xl border border-slate-700/80 bg-slate-800/50 px-4 py-3 text-sm text-white
                                                   placeholder:text-slate-500 transition-all duration-200
                                                   focus:border-nerve/50 focus:outline-none focus:ring-2 focus:ring-nerve/20"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full rounded-xl bg-nerve px-4 py-3 text-sm font-semibold text-white
                                               transition-all duration-200 hover:brightness-110 hover:shadow-lg hover:shadow-nerve/20
                                               disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                                                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                                            </svg>
                                            Sending…
                                        </span>
                                    ) : 'Send Reset Link'}
                                </button>
                            </form>
                        )}
                    </div>

                    <p className="mt-6 text-center text-sm text-slate-500">
                        Remember your password?{' '}
                        <Link href="/login" className="text-nerve hover:text-nerve/80 transition-colors">
                            Sign in →
                        </Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
