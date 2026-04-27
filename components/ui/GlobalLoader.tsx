/**
 * GlobalLoader
 *
 * Single, branded full-screen loader used across the entire app shell.
 * Used by:
 *  - Next.js root and route-level `loading.tsx` files
 *  - `AuthGuard` while the session is resolving
 *  - `WorkspaceLayout` while the active workspace is resolving
 *
 * Keeping a single visual prevents the cascading "site → page → sidebar"
 * loader flicker on reload.
 */
export function GlobalLoader({ label }: { label?: string }) {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
        >
            <div className="flex flex-col items-center gap-4">
                <div className="relative h-12 w-12">
                    {/* Brand glyph — matches sidebar logo */}
                    <svg
                        viewBox="0 0 32 32"
                        fill="none"
                        aria-hidden="true"
                        className="absolute inset-0 m-auto h-6 w-6"
                    >
                        <path
                            d="M10 6C6.134 6 3 9.134 3 13s3.134 7 7 7"
                            stroke="hsl(166,84%,39%)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />
                        <path
                            d="M22 26c3.866 0 7-3.134 7-7s-3.134-7-7-7"
                            stroke="hsl(166,84%,39%)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />
                        <circle cx="16" cy="16" r="2.5" fill="hsl(166,84%,39%)" opacity="0.5" />
                    </svg>
                    <div className="h-12 w-12 animate-spin rounded-full border-2 border-border border-t-nerve" />
                </div>
                {label ? (
                    <p className="text-sm text-muted-foreground">{label}</p>
                ) : (
                    <span className="sr-only">Loading</span>
                )}
            </div>
        </div>
    );
}

export default GlobalLoader;
