'use client';

export default function WorkspaceError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8">
            <div className="rounded-xl border border-health-critical/20 bg-health-critical/5 p-8 text-center max-w-lg">
                <div className="mb-4 text-4xl">⚠️</div>
                <h2 className="mb-2 text-xl font-semibold text-white">
                    Workspace Error
                </h2>
                <p className="mb-6 text-sm text-zinc-400">
                    {error.message || 'An unexpected error occurred while loading the workspace.'}
                </p>
                <button
                    onClick={reset}
                    className="rounded-lg bg-nerve px-6 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-nerve/20"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
