import Link from 'next/link';

/**
 * 404 Not Found Page
 *
 * Displayed when a user navigates to a route that doesn't exist.
 */

export default function NotFound() {
    return (
        <div className="min-h-screen bg-gradient-midnight relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 bg-grid opacity-20" />

            <div className="relative z-10 text-center max-w-md px-6 animate-fade-in">
                {/* 404 Visual */}
                <div className="mb-6">
                    <span className="text-7xl font-bold text-gradient">
                        404
                    </span>
                </div>

                <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
                <p className="text-slate-400 mb-8 text-sm leading-relaxed">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>

                <div className="flex gap-3 justify-center">
                    <Link
                        href="/"
                        className="btn-primary px-6 py-2.5 rounded-lg"
                    >
                        Go home
                    </Link>
                    <Link
                        href="/login"
                        className="btn-outline border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white px-6 py-2.5 rounded-lg"
                    >
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
