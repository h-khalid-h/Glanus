'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function AssetsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Assets error:', error);
    }, [error]);

    return (
        <div className="container mx-auto px-4 py-12 max-w-lg text-center">
            <div className="rounded-xl border border-health-critical/20 bg-health-critical/5 p-8">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-health-critical/10">
                    <AlertTriangle className="h-7 w-7 text-health-critical" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
                <p className="text-sm text-slate-400 mb-6">
                    {error.message || 'An unexpected error occurred while loading assets.'}
                </p>
                <button type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110 transition-colors"
                >
                    <RotateCcw size={16} />
                    Try Again
                </button>
            </div>
        </div>
    );
}
