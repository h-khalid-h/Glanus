import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
    const session = await getServerSession(authOptions);
    if (session?.user) {
        redirect('/dashboard');
    }

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Background grid pattern */}
            <div className="absolute inset-0 bg-grid opacity-15" />

            {/* Ambient glow effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-8 blur-3xl bg-primary" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-5 blur-3xl bg-cortex" />

            {/* Content */}
            <div className="relative z-10 flex min-h-screen flex-col">

                {/* Header */}
                <header className="flex items-center justify-between px-6 py-5 md:px-12">
                    <div className="flex items-center gap-2.5">
                        {/* Glanus dual-arc mark */}
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 6C6.134 6 3 9.134 3 13s3.134 7 7 7"
                                stroke="hsl(166, 84%, 39%)" strokeWidth="2.5" strokeLinecap="round" />
                            <path d="M22 26c3.866 0 7-3.134 7-7s-3.134-7-7-7"
                                stroke="hsl(166, 84%, 39%)" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx="16" cy="16" r="2" fill="hsl(166, 84%, 39%)" opacity="0.6" />
                        </svg>
                        <span className="text-lg font-bold text-foreground">Glanus</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/login"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Sign in
                        </Link>
                        <Link
                            href="/signup"
                            className="btn-primary px-5 py-2 text-sm font-semibold rounded-xl"
                        >
                            Get Started
                        </Link>
                    </div>
                </header>

                {/* Hero */}
                <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
                    <div className="animate-fade-in max-w-3xl">
                        {/* Glanus mark — large */}
                        <div className="mb-10 flex justify-center">
                            <svg width="72" height="72" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"
                                className="animate-glow rounded-2xl p-3">
                                <path d="M10 6C6.134 6 3 9.134 3 13s3.134 7 7 7"
                                    stroke="hsl(166, 84%, 39%)" strokeWidth="2" strokeLinecap="round" />
                                <path d="M22 26c3.866 0 7-3.134 7-7s-3.134-7-7-7"
                                    stroke="hsl(166, 84%, 39%)" strokeWidth="2" strokeLinecap="round" />
                                <circle cx="16" cy="16" r="2.5" fill="hsl(166, 84%, 39%)" opacity="0.7" />
                            </svg>
                        </div>

                        {/* Headline */}
                        <h1 className="mb-5 text-5xl font-extrabold tracking-tight text-foreground sm:text-7xl leading-[1.05]">
                            The infrastructure<br />
                            <span className="text-gradient">that thinks.</span>
                        </h1>

                        <p className="mx-auto mb-12 max-w-xl text-lg leading-relaxed text-muted-foreground">
                            Glanus is an AI-native operations platform that doesn&apos;t just monitor your
                            infrastructure — it reasons about it, predicts failures, and runs operations autonomously.
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                            <Link
                                href="/signup"
                                className="btn-primary px-8 py-3 text-base font-semibold rounded-xl"
                            >
                                Get Started Free
                            </Link>
                            <Link
                                href="/login"
                                className="btn-outline border-border text-foreground hover:border-primary/30 
                                           hover:text-primary px-8 py-3 text-base rounded-xl"
                            >
                                Sign In
                            </Link>
                        </div>
                    </div>

                    {/* Layer cards */}
                    <div className="mt-24 grid max-w-5xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 animate-slide-up [animation-delay:0.2s]">

                        {/* NERVE */}
                        <div className="group rounded-2xl border border-border bg-card/60 p-6 
                                        backdrop-blur-sm transition-all duration-300 hover:border-nerve/30 hover:-translate-y-0.5 hover:shadow-lg">
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-nerve/10">
                                <svg className="h-5 w-5 text-nerve" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                </svg>
                            </div>
                            <h3 className="mb-1.5 text-sm font-bold text-foreground">NERVE</h3>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Unified data fabric that connects, enriches, and understands your entire infrastructure.
                            </p>
                        </div>

                        {/* CORTEX */}
                        <div className="group rounded-2xl border border-border bg-card/60 p-6 
                                        backdrop-blur-sm transition-all duration-300 hover:border-cortex/30 hover:-translate-y-0.5 hover:shadow-lg">
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-cortex/10">
                                <svg className="h-5 w-5 text-cortex" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                                </svg>
                            </div>
                            <h3 className="mb-1.5 text-sm font-bold text-foreground">CORTEX</h3>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Multi-model reasoning engine that understands cause, context, and consequence.
                            </p>
                        </div>

                        {/* ORACLE */}
                        <div className="group rounded-2xl border border-border bg-card/60 p-6 
                                        backdrop-blur-sm transition-all duration-300 hover:border-oracle/30 hover:-translate-y-0.5 hover:shadow-lg">
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-oracle/10">
                                <svg className="h-5 w-5 text-oracle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h3 className="mb-1.5 text-sm font-bold text-foreground">ORACLE</h3>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Prediction engine that forecasts failures, capacity, and risk before they happen.
                            </p>
                        </div>

                        {/* REFLEX */}
                        <div className="group rounded-2xl border border-border bg-card/60 p-6 
                                        backdrop-blur-sm transition-all duration-300 hover:border-reflex/30 hover:-translate-y-0.5 hover:shadow-lg">
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-reflex/10">
                                <svg className="h-5 w-5 text-reflex" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                </svg>
                            </div>
                            <h3 className="mb-1.5 text-sm font-bold text-foreground">REFLEX</h3>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Autonomous action engine that resolves issues with trust, transparency, and precision.
                            </p>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="px-6 py-8 text-center text-xs text-muted-foreground md:px-12">
                    <div className="flex items-center justify-center gap-4">
                        <p>Glanus — AI-Native IT Operations Platform</p>
                        <span className="text-border">·</span>
                        <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
