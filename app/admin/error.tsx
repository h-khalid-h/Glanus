'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Admin error:', error);
    }, [error]);

    return (
        <div className="container mx-auto px-4 py-12 max-w-lg text-center">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle className="h-7 w-7 text-destructive" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
                <p className="text-sm text-muted-foreground mb-6">
                    {error.message || 'An unexpected error occurred in the admin panel.'}
                </p>
                <button type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-foreground rounded-xl hover:brightness-110 transition-colors"
                >
                    <RotateCcw size={16} />
                    Try Again
                </button>
            </div>
        </div>
    );
}
