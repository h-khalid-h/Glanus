import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SuperAdminSidebar } from '@/components/super-admin/SuperAdminSidebar';

export const metadata: Metadata = {
    title: {
        template: '%s · Glanus Admin',
        default: 'System Management · Glanus',
    },
    description: 'Platform-wide system administration for Glanus staff',
    robots: { index: false, follow: false },
};

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
    // Server-side guard — only ADMIN and IT_STAFF may access this layout.
    // The middleware already redirects staff on login; this check is a
    // defense-in-depth fallback for direct URL access.
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        redirect('/login');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true, isStaff: true, name: true, email: true },
    });

    if (!user?.isStaff) {
        // Non-staff users should never reach here — send them home
        redirect('/dashboard');
    }

    return (
        <div className="flex min-h-screen bg-[#060b14] text-foreground antialiased">
            <SuperAdminSidebar />
            <div className="flex flex-1 flex-col lg:pl-64">
                <main className="flex-1 overflow-y-auto">
                    <div className="px-6 py-6 lg:px-8 lg:py-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
