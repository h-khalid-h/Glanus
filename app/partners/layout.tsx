'use client';

import { usePathname } from 'next/navigation';
import { PartnerNav } from '@/components/PartnerNav';

// Routes that should NOT show the partner navigation bar
// (standalone pages with their own layout)
const STANDALONE_ROUTES = ['/partners/signup'];

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isStandalone = STANDALONE_ROUTES.some(route => pathname.startsWith(route));

    // Public partner profile pages (/partners/:uuid) are also standalone
    const isPublicProfile = /^\/partners\/[a-f0-9-]+$/.test(pathname);

    if (isStandalone || isPublicProfile) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-gradient-midnight p-6 lg:p-8">
            <PartnerNav />
            {children}
        </div>
    );
}
