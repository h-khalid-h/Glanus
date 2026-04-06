import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

export const metadata: Metadata = {
    title: 'Account Settings',
    description: 'Manage your profile, security, and workspace memberships',
};

export default function AccountLayout({ children }: { children: ReactNode }) {
    return <AuthGuard><WorkspaceLayout>{children}</WorkspaceLayout></AuthGuard>;
}
