'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const NAV_ITEMS = [
    {
        href: '/partners/dashboard',
        label: 'Dashboard',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
        href: '/partners/earnings',
        label: 'Earnings',
        icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
    },
    {
        href: '/partners/certification',
        label: 'Certification',
        icon: 'M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5',
    },
];

export function PartnerNav() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (href: string) => pathname.startsWith(href);

    return (
        <nav className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-5">
                <Link href="/partners/dashboard" className="flex items-center gap-2">
                    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                        <path d="M10 6C6.134 6 3 9.134 3 13s3.134 7 7 7"
                            stroke="hsl(166, 84%, 39%)" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M22 26c3.866 0 7-3.134 7-7s-3.134-7-7-7"
                            stroke="hsl(166, 84%, 39%)" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="16" cy="16" r="2" fill="hsl(166, 84%, 39%)" opacity="0.6" />
                    </svg>
                    <span className="text-lg font-semibold text-foreground">Partner Portal</span>
                </Link>
                <div className="hidden gap-1 md:flex">
                    {NAV_ITEMS.map(({ href, label, icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${isActive(href)
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                            </svg>
                            {label}
                        </Link>
                    ))}
                </div>

                {/* Mobile hamburger */}
                <button type="button"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
                    aria-label="Toggle navigation"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        {mobileOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        )}
                    </svg>
                </button>
            </div>

            <div className="flex items-center gap-3">
                <ThemeToggle />
                <Link
                    href="/dashboard"
                    className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground
                               transition-all hover:border-border hover:text-foreground"
                >
                    ← Back to Platform
                </Link>
                {session?.user && (
                    <div className="flex items-center gap-3">
                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-medium text-foreground">{session.user.name}</p>
                        </div>
                        <button type="button"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground
                                       transition-all hover:border-border hover:text-foreground"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile dropdown */}
            {mobileOpen && (
                <div className="absolute left-0 right-0 top-full z-40 border-b border-border bg-card/95 backdrop-blur-xl p-4 md:hidden">
                    <div className="flex flex-col gap-1">
                        {NAV_ITEMS.map(({ href, label, icon }) => (
                            <Link
                                key={href}
                                href={href}
                                onClick={() => setMobileOpen(false)}
                                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive(href)
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                    }`}
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                                </svg>
                                {label}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
}
