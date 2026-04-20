'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '@/lib/toast';
import { ToastContainer } from '@/components/ui/Toast';
import { WorkspaceProvider } from '@/lib/workspace/context';
import { CommandSurface } from '@/components/command/CommandSurface';
import { RBACProvider } from '@/components/RBACProvider';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { ThemeProvider } from '@/components/ThemeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <SessionProvider refetchOnWindowFocus={false}>
                <RBACProvider>
                    <WorkspaceProvider>
                        <ToastProvider>
                            <ImpersonationBanner />
                            {children}
                            <ToastContainer />
                            <CommandSurface />
                        </ToastProvider>
                    </WorkspaceProvider>
                </RBACProvider>
            </SessionProvider>
        </ThemeProvider>
    );
}
