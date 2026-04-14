'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await login({ email, password });

            if (!result.ok) {
                setError(result.error || 'Invalid credentials');
            } else {
                if (result.user?.isStaff) {
                    router.push('/super-admin');
                } else {
                    router.push('/dashboard');
                }
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
        <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
            {/* Background grid pattern */}
            <div className="absolute inset-0 bg-grid opacity-15" />

            {/* Ambient glow effects */}
            <div className="absolute top-0 right-1/4 w-80 h-80 rounded-full opacity-5 blur-3xl bg-primary" />
            <div className="absolute bottom-1/3 left-1/6 w-64 h-64 rounded-full opacity-4 blur-3xl bg-cortex" />

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
                <Link href="/" className="flex items-center gap-2.5">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 6C6.134 6 3 9.134 3 13s3.134 7 7 7"
                            stroke="hsl(166, 84%, 39%)" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M22 26c3.866 0 7-3.134 7-7s-3.134-7-7-7"
                            stroke="hsl(166, 84%, 39%)" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="16" cy="16" r="2" fill="hsl(166, 84%, 39%)" opacity="0.6" />
                    </svg>
                    <span className="text-lg font-bold text-foreground">Glanus</span>
                </Link>
            </header>

            {/* Main content */}
            <main className="relative z-10 flex flex-1 items-center justify-center px-4">
                <div className="w-full max-w-md animate-fade-in">
                    {/* Heading */}
                    <div className="mb-8 text-center">
                        <h1 className="mb-2 text-3xl font-extrabold text-foreground">Welcome back</h1>
                        <p className="text-muted-foreground">Sign in to your operations platform</p>
                    </div>

                    {/* Glass card */}
                    <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-8" style={{ boxShadow: 'var(--shadow-xl)' }}>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                                    {error}
                                </div>
                            )}

                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
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
                                    className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground
                                               placeholder:text-muted-foreground/50 transition-all duration-200
                                               focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        autoComplete="current-password"
                                        className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 pr-11 text-sm text-foreground
                                                   placeholder:text-muted-foreground/50 transition-all duration-200
                                                   focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Forgot password */}
                            <div className="flex justify-end">
                                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                                    Forgot password?
                                </Link>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground
                                           transition-all duration-200 hover:brightness-110 hover:shadow-lg hover:shadow-primary/20
                                           active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    <div className="h-px flex-1 bg-border" />
                                    <span className="text-xs text-muted-foreground">Quick access (dev only)</span>
                                    <div className="h-px flex-1 bg-border" />
                                </div>

                                <div className="space-y-2">
                                    {[
                                        { label: 'Admin', email: 'admin@glanus.com', password: 'password123', badge: 'Full access' },
                                        { label: 'IT Staff', email: 'staff@glanus.com', password: 'password123', badge: 'Operations' },
                                        { label: 'User', email: 'john@glanus.com', password: 'password123', badge: 'Read only' },
                                    ].map((demo) => (
                                        <button type="button"
                                            key={demo.email}
                                            onClick={() => fillDemo(demo.email, demo.password)}
                                            className="w-full group flex items-center justify-between rounded-xl border border-border 
                                               bg-muted/30 px-4 py-2.5 text-left transition-all duration-200
                                               hover:border-primary/20 hover:bg-accent"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-bold">
                                                    {demo.label[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{demo.label}</p>
                                                    <p className="text-xs text-muted-foreground">{demo.email}</p>
                                                </div>
                                            </div>
                                            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                {demo.badge}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Footer link */}
                        <p className="mt-6 text-center text-sm text-muted-foreground">
                            Don&apos;t have an account?{' '}
                            <Link href="/signup" className="text-primary hover:text-primary/80 font-medium transition-colors">
                                Create one →
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
