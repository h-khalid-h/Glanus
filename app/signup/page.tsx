'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to create account');
                return;
            }

            // Auto-sign in after successful signup
            const loginResult = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (loginResult?.error) {
                // Account created but login failed — redirect to login
                router.push('/login');
            } else {
                router.push('/onboarding');
                router.refresh();
            }
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-midnight relative overflow-hidden flex flex-col">
            {/* Background */}
            <div className="absolute inset-0 bg-grid opacity-30" />
            <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full opacity-8 blur-3xl bg-cortex" />
            <div className="absolute bottom-1/3 right-1/4 w-64 h-64 rounded-full opacity-6 blur-3xl bg-nerve" />

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

            {/* Main */}
            <main className="relative z-10 flex flex-1 items-center justify-center px-4">
                <div className="w-full max-w-md animate-fade-in">
                    <div className="mb-8 text-center">
                        <h1 className="mb-2 text-3xl font-bold text-white">Create your account</h1>
                        <p className="text-slate-400">Start managing your infrastructure in minutes</p>
                    </div>

                    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="rounded-lg bg-health-critical/10 border border-health-critical/20 p-3 text-sm text-health-critical">
                                    {error}
                                </div>
                            )}

                            {/* Name */}
                            <div>
                                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-300">
                                    Full Name
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Jane Smith"
                                    required
                                    minLength={2}
                                    autoComplete="name"
                                    className="w-full rounded-xl border border-slate-700/80 bg-slate-800/50 px-4 py-3 text-sm text-white
                                               placeholder:text-slate-500 transition-all duration-200
                                               focus:border-nerve/50 focus:outline-none focus:ring-2 focus:ring-nerve/20"
                                />
                            </div>

                            {/* Email */}
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

                            {/* Password */}
                            <div>
                                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min 8 chars, uppercase, number, special"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                    className="w-full rounded-xl border border-slate-700/80 bg-slate-800/50 px-4 py-3 text-sm text-white
                                               placeholder:text-slate-500 transition-all duration-200
                                               focus:border-nerve/50 focus:outline-none focus:ring-2 focus:ring-nerve/20"
                                />
                                <p className="mt-1.5 text-xs text-slate-500">
                                    Must include uppercase, lowercase, number, and special character
                                </p>
                            </div>

                            {/* Submit */}
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
                                        Creating account…
                                    </span>
                                ) : 'Create Account'}
                            </button>
                        </form>

                        <p className="mt-4 text-center text-xs text-slate-500">
                            By creating an account, you agree to our{' '}
                            <Link href="/terms" className="text-nerve hover:text-nerve/80 transition-colors underline">
                                Terms of Service
                            </Link>{' '}
                            and{' '}
                            <Link href="/privacy" className="text-nerve hover:text-nerve/80 transition-colors underline">
                                Privacy Policy
                            </Link>
                        </p>
                    </div>

                    {/* Footer link */}
                    <p className="mt-6 text-center text-sm text-slate-500">
                        Already have an account?{' '}
                        <Link href="/login" className="text-nerve hover:text-nerve/80 transition-colors">
                            Sign in →
                        </Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
