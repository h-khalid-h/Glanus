'use client';

/**
 * Workspace Loading Shell
 *
 * Provides a rich skeleton UI while the workspace page streams in.
 * This replaces the basic spinner with a layout-matching skeleton
 * for a smoother perceived loading experience.
 */

export default function WorkspaceLoading() {
    return (
        <div className="flex min-h-[60vh] flex-col gap-6 p-6 animate-pulse">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-6 w-48 rounded-xl bg-accent" />
                    <div className="h-4 w-72 rounded bg-muted/40" />
                </div>
                <div className="h-10 w-32 rounded-xl bg-accent" />
            </div>

            {/* Stats row skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 rounded-xl border border-border bg-card p-4">
                        <div className="h-3 w-20 rounded bg-accent mb-3" />
                        <div className="h-7 w-16 rounded bg-accent mb-2" />
                        <div className="h-2 w-full rounded-full bg-muted/40" />
                    </div>
                ))}
            </div>

            {/* Main content skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 h-72 rounded-xl border border-border bg-card" />
                <div className="h-72 rounded-xl border border-border bg-card" />
            </div>
        </div>
    );
}
