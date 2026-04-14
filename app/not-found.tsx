import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Page Not Found',
};

/**
 * 404 Not Found Page
 *
 * Displayed when a user navigates to a route that doesn't exist.
 */

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 bg-grid opacity-10" />

            <div className="relative z-10 text-center max-w-md px-6 animate-fade-in">
                {/* 404 Visual */}
                <div className="mb-8">
                    <span className="text-8xl font-extrabold text-gradient">
                        404
                    </span>
                </div>

                <h1 className="text-2xl font-bold text-foreground mb-3">Page not found</h1>
                <p className="text-muted-foreground mb-10 text-sm leading-relaxed">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>

                <div className="flex gap-3 justify-center">
                    <Link
                        href="/"
                        className="btn-primary px-6 py-2.5 rounded-xl"
                    >
                        Go home
                    </Link>
                    <Link
                        href="/login"
                        className="btn-outline border-border text-foreground hover:border-primary/30 hover:text-primary px-6 py-2.5 rounded-xl"
                    >
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
