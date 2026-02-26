'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError(result.error);
            } else {
                router.push('/dashboard');
                router.refresh();
            }
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : 'An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const fillDemo = (demoEmail: string, demoPassword: string) => {
        setEmail(demoEmail);
        setPassword(demoPassword);
    };

    return (
        <div className="min-h-screen bg-gradient-midnight relative overflow-hidden flex flex-col">
            {/* Background grid pattern */}
            <div className="absolute inset-0 bg-grid opacity-30" />

            {/* Ambient glow effects */}
            <div className="absolute top-0 right-1/4 w-80 h-80 rounded-full opacity-8 blur-3xl bg-nerve" />
            <div className="absolute bottom-1/3 left-1/6 w-64 h-64 rounded-full opacity-6 blur-3xl bg-violet-500" />

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

            {/* Main content */}
            <main className="relative z-10 flex flex-1 items-center justify-center px-4">
                <div className="w-full max-w-md animate-fade-in">
                    {/* Heading */}
                    <div className="mb-8 text-center">
                        <h1 className="mb-2 text-3xl font-bold text-white">Welcome back</h1>
                        <p className="text-slate-400">Sign in to your operations platform</p>
                    </div>

                    {/* Glass card */}
                    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="rounded-lg bg-health-critical/10 border border-health-critical/20 p-3 text-sm text-health-critical">
                                    {error}
                                </div>
                            )}

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
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className="w-full rounded-xl border border-slate-700/80 bg-slate-800/50 px-4 py-3 text-sm text-white
                                               placeholder:text-slate-500 transition-all duration-200
                                               focus:border-nerve/50 focus:outline-none focus:ring-2 focus:ring-nerve/20"
                                />
                            </div>

                            {/* Forgot password */}
                            <div className="flex justify-end">
                                <Link href="/forgot-password" className="text-xs text-slate-500 hover:text-nerve transition-colors">
                                    Forgot password?
                                </Link>
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
                                        Signing in…
                                    </span>
                                ) : 'Sign In'}
                            </button>
                        </form>

                        {/* Demo accounts (development only) */}
                        {process.env.NODE_ENV !== 'production' && (
                            <>
                                {/* Divider */}
                                <div className="my-6 flex items-center gap-3">
                                    <div className="h-px flex-1 bg-slate-700/50" />
                                    <span className="text-xs text-slate-500">Quick access (dev only)</span>
                                    <div className="h-px flex-1 bg-slate-700/50" />
                                </div>

                                <div className="space-y-2">
                                    {[
                                        { label: 'Admin', email: 'admin@glanus.com', password: 'password123', badge: 'Full access' },
                                        { label: 'IT Staff', email: 'staff@glanus.com', password: 'password123', badge: 'Operations' },
                                        { label: 'User', email: 'john@glanus.com', password: 'password123', badge: 'Read only' },
                                    ].map((demo) => (
                                        <button
                                            key={demo.email}
                                            type="button"
                                            onClick={() => fillDemo(demo.email, demo.password)}
                                            className="w-full group flex items-center justify-between rounded-xl border border-slate-700/50 
                                               bg-slate-800/30 px-4 py-2.5 text-left transition-all duration-200
                                               hover:border-slate-600 hover:bg-slate-800/60"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nerve/10 text-nerve text-xs font-bold">
                                                    {demo.label[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-200 group-hover:text-white">{demo.label}</p>
                                                    <p className="text-xs text-slate-500">{demo.email}</p>
                                                </div>
                                            </div>
                                            <span className="rounded-full bg-slate-700/50 px-2.5 py-0.5 text-[10px] font-medium text-slate-400">
                                                {demo.badge}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Footer link */}
                        <p className="mt-6 text-center text-sm text-slate-500">
                            Don&apos;t have an account?{' '}
                            <Link href="/signup" className="text-nerve hover:text-nerve/80 transition-colors">
                                Create one →
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
