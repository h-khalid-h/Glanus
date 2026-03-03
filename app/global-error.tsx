'use client';

/**
 * Global Error Boundary
 *
 * Catches unhandled errors in the application and displays
 * a user-friendly recovery UI.
 */

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

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
        <html>
            <body className="bg-gradient-midnight text-white flex items-center justify-center min-h-screen">
                <div className="text-center max-w-md px-6">
                    {/* Icon */}
                    <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-health-critical/10 text-health-critical">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold mb-3">Something went wrong</h2>
                    <p className="text-slate-400 mb-8 text-sm leading-relaxed">
                        An unexpected error occurred. Our team has been notified and is looking into it.
                    </p>

                    <div className="flex gap-3 justify-center">
                        <button type="button"
                    aria-label="Try again"
                            onClick={() => reset()}
                            className="px-6 py-2.5 bg-nerve text-white font-medium rounded-lg transition-all hover:brightness-110 hover:shadow-lg hover:shadow-nerve/20"
                        >
                            Try again
                        </button>
                        <a
                            href="/"
                            className="px-6 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium rounded-lg transition-colors"
                        >
                            Go home
                        </a>
                    </div>

                    {error.digest && (
                        <p className="mt-8 text-xs text-slate-500">
                            Error ID: {error.digest}
                        </p>
                    )}
                </div>
            </body>
        </html>
    );
}
