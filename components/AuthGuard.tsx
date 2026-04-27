'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { GlobalLoader } from '@/components/ui/GlobalLoader';

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
        return <GlobalLoader />;
    }

    if (!session) {
        // Keep the unified loader visible while we redirect, instead of
        // briefly flashing an empty page.
        return <GlobalLoader />;
    }

    return <>{children}</>;
}
