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
                    <div className="h-6 w-48 rounded-lg bg-slate-800/60" />
                    <div className="h-4 w-72 rounded bg-slate-800/40" />
                </div>
                <div className="h-10 w-32 rounded-lg bg-slate-800/60" />
            </div>

            {/* Stats row skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                        <div className="h-3 w-20 rounded bg-slate-800/60 mb-3" />
                        <div className="h-7 w-16 rounded bg-slate-800/60 mb-2" />
                        <div className="h-2 w-full rounded-full bg-slate-800/40" />
                    </div>
                ))}
            </div>

            {/* Main content skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 h-72 rounded-xl border border-slate-800 bg-slate-900/50" />
                <div className="h-72 rounded-xl border border-slate-800 bg-slate-900/50" />
            </div>
        </div>
    );
}
