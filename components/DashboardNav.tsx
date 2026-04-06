'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import { useWorkspace } from '@/lib/workspace/context';

const ICON_PATHS = {
    dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    assets: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
    remote: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12',
    insights: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z',
};

function buildNavItems() {
    return [
        { href: '/dashboard', label: 'Dashboard', icon: ICON_PATHS.dashboard },
        { href: '/workspaces/analytics', label: 'Mission Control', icon: ICON_PATHS.assets },
        { href: '/remote', label: 'Remote', icon: ICON_PATHS.remote },
        { href: '/workspaces/intelligence', label: 'Insights', icon: ICON_PATHS.insights },
    ];
}

export function DashboardNav() {
    const { data: session } = useSession();
    const { workspace } = useWorkspace();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const NAV_ITEMS = buildNavItems();

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname.startsWith(href);
    };

    return (
        <nav className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-5">
                <WorkspaceSwitcher />
                <Link href="/dashboard" className="flex items-center gap-2">
                    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                        <path d="M10 6C6.134 6 3 9.134 3 13s3.134 7 7 7"
                            stroke="hsl(168, 100%, 45%)" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M22 26c3.866 0 7-3.134 7-7s-3.134-7-7-7"
                            stroke="hsl(168, 100%, 45%)" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="16" cy="16" r="2" fill="hsl(168, 100%, 45%)" opacity="0.6" />
                    </svg>
                    <span className="text-lg font-semibold text-foreground">Glanus</span>
                </Link>
                <div className="hidden gap-1 md:flex">
                    {NAV_ITEMS.map(({ href, label, icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${isActive(href)
                                ? 'bg-nerve/10 text-nerve'
                                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
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
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/50 text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200 md:hidden"
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
                {session?.user && (
                    <div className="flex items-center gap-3">
                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-medium text-slate-200">{session.user.name}</p>
                            <p className="text-xs text-slate-500">{session.user.role.replace('_', ' ')}</p>
                        </div>
                        <button type="button"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="rounded-lg border border-slate-700/50 px-3 py-1.5 text-xs font-medium text-slate-400
                                       transition-all hover:border-slate-600 hover:text-slate-200"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile dropdown */}
            {mobileOpen && (
                <div className="absolute left-0 right-0 top-full z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur-xl p-4 md:hidden">
                    <div className="flex flex-col gap-1">
                        {NAV_ITEMS.map(({ href, label, icon }) => (
                            <Link
                                key={href}
                                href={href}
                                onClick={() => setMobileOpen(false)}
                                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive(href)
                                    ? 'bg-nerve/10 text-nerve'
                                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
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

