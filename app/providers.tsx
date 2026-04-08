'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '@/lib/toast';
import { ToastContainer } from '@/components/ui/Toast';
import { WorkspaceProvider } from '@/lib/workspace/context';
import { CommandSurface } from '@/components/command/CommandSurface';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider refetchOnWindowFocus={false}>
            <WorkspaceProvider>
                <ToastProvider>
                    {children}
                    <ToastContainer />
                    <CommandSurface />
                </ToastProvider>
            </WorkspaceProvider>
        </SessionProvider>
    );
}
