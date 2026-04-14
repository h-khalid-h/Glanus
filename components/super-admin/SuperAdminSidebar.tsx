'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
    LayoutDashboard,
    Building2,
    BarChart2,
    ScrollText,
    ShieldCheck,
    LogOut,
    ChevronRight,
    Shield,
    CreditCard,
} from 'lucide-react';

const NAV = [
    { href: '/super-admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/super-admin/workspaces', label: 'Workspaces', icon: Building2 },
    { href: '/super-admin/billing', label: 'Billing', icon: CreditCard },
    { href: '/super-admin/analytics', label: 'Analytics', icon: BarChart2 },
    { href: '/super-admin/audit', label: 'Audit Log', icon: ScrollText },
];

export function SuperAdminSidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const isActive = (href: string, exact?: boolean) =>
        exact ? pathname === href : pathname.startsWith(href);

    // Alert banner — show role-specific badge
    const role = session?.user?.role as string | undefined;
    const isAdmin = role === 'ADMIN';
    const roleLabel = isAdmin ? 'Super Admin' : 'IT Staff';
    const roleBadgeColor = isAdmin
        ? 'border-rose-500/20 bg-rose-500/5'
        : 'border-indigo-500/20 bg-indigo-500/5';
    const roleDotColor = isAdmin ? 'bg-rose-400' : 'bg-indigo-400';
    const roleTextColor = isAdmin ? 'text-rose-400' : 'text-indigo-400';

    return (
        <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-800/50 bg-[#07101f]">
            {/* Brand */}
            <Link
                href="/super-admin"
                className="group flex h-14 shrink-0 items-center gap-3 border-b border-slate-800/50 px-5 transition-colors hover:bg-slate-800/20"
            >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/30 transition-all group-hover:ring-indigo-500/50">
                    <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-100 leading-tight">System Management</p>
                    <p className="text-[10px] font-medium text-slate-600 leading-tight">Glanus Platform</p>
                </div>
            </Link>

            {/* Role badge */}
            <div className={`mx-3 mt-3 rounded-lg border px-3 py-2 ${roleBadgeColor}`}>
                <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${roleDotColor}`} />
                    <p className={`text-[11px] font-semibold ${roleTextColor}`}>
                        {roleLabel} Access
                    </p>
                    <Shield className={`ml-auto h-3 w-3 opacity-50 ${roleTextColor}`} />
                </div>
                <p className="mt-0.5 text-[10px] text-slate-600">All tenant data is visible</p>
            </div>

            {/* Nav */}
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
                {NAV.map(({ href, label, icon: Icon, exact }) => {
                    const active = isActive(href, exact);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={[
                                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                                active
                                    ? 'bg-indigo-500/10 text-indigo-300 shadow-inner shadow-indigo-500/5'
                                    : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-300',
                            ].join(' ')}
                        >
                            <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                            {label}
                            {active && <ChevronRight className="ml-auto h-3 w-3 text-indigo-500/50" />}
                        </Link>
                    );
                })}
            </nav>

            {/* Return to workspace */}
            <div className="shrink-0 border-t border-slate-800/50 p-3 space-y-1">
                <Link
                    href="/workspaces"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 transition-colors hover:text-slate-300 hover:bg-slate-800/40"
                >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Platform
                </Link>
                {mounted && (
                    <div className="flex items-center gap-2.5 rounded-xl px-3 py-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-400 ring-1 ring-indigo-500/20">
                            {(session?.user?.name?.[0] || session?.user?.email?.[0] || 'A').toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-300 truncate">{session?.user?.name || 'Admin'}</p>
                            <p className="text-[10px] text-slate-600 truncate">{session?.user?.email}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            title="Sign out"
                            className="text-slate-600 hover:text-rose-400 transition-colors"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
