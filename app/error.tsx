'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 animate-fade-in">
            <div className="rounded-2xl border border-destructive/15 bg-card p-10 text-center max-w-lg" style={{ boxShadow: 'var(--shadow-lg)' }}>
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-3xl">⚠️</div>
                <h2 className="mb-2 text-xl font-bold text-foreground">
                    Something went wrong
                </h2>
                <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
                    {error.message || 'An unexpected error occurred. Please try again.'}
                </p>
                <button type="button"
                    onClick={reset}
                    className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.97]"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
