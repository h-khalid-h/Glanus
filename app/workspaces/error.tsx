'use client';

import Link from 'next/link';

export default function WorkspaceError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center max-w-lg">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h2 className="mb-2 text-xl font-semibold text-foreground">
                    Workspace Error
                </h2>
                <p className="mb-6 text-sm text-muted-foreground">
                    {error.message || 'An unexpected error occurred while loading the workspace.'}
                </p>
                <div className="flex gap-3 justify-center">
                    <button type="button"
                        onClick={reset}
                        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-foreground transition-all hover:brightness-110 hover:shadow-lg hover:shadow-primary/20"
                    >
                        Try again
                    </button>
                    <Link
                        href="/dashboard"
                        className="rounded-xl border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                    >
                        Go to Dashboard
                    </Link>
                </div>
                {error.digest && (
                    <p className="mt-6 text-xs text-muted-foreground">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>
        </div>
    );
}

