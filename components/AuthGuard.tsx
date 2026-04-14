'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { session, status, isLoading, refresh } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            // Attempt one silent refresh before redirecting to login
            refresh().then((ok) => {
                if (!ok) {
                    router.push('/login');
                }
            });
        }
    }, [status, router, refresh]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="text-center">
                    <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-border border-t-nerve"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return null;
    }

    return <>{children}</>;
}
