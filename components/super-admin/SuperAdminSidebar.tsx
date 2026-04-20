'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    LayoutDashboard,
    Building2,
    BarChart2,
    ScrollText,
    ShieldCheck,
    ChevronRight,
    Shield,
    CreditCard,
    Users2,
} from 'lucide-react';

const NAV = [
    { href: '/super-admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/super-admin/workspaces', label: 'Workspaces', icon: Building2 },
    { href: '/super-admin/users', label: 'Users & Roles', icon: Users2 },
    { href: '/super-admin/billing', label: 'Billing', icon: CreditCard },
    { href: '/super-admin/analytics', label: 'Analytics', icon: BarChart2 },
    { href: '/super-admin/audit', label: 'Audit Log', icon: ScrollText },
    { href: '/super-admin/roles', label: 'Roles & Permissions', icon: Shield },
];

export function SuperAdminSidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();

    const isActive = (href: string, exact?: boolean) =>
        exact ? pathname === href : pathname.startsWith(href);

    // Alert banner — show role-specific badge
    const role = session?.user?.role as string | undefined;
    const isAdmin = role === 'ADMIN';
    const roleLabel = isAdmin ? 'Super Admin' : 'IT Staff';
    const roleBadgeColor = isAdmin
        ? 'border-warning/30 bg-warning/10'
        : 'border-primary/30 bg-primary/10';
    const roleDotColor = isAdmin ? 'bg-warning' : 'bg-primary';
    const roleTextColor = isAdmin ? 'text-warning' : 'text-primary';

    return (
        <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 z-50 w-64 border-r border-border/50 bg-sidebar">
            {/* Brand */}
            <Link
                href="/super-admin"
                className="group flex h-14 shrink-0 items-center gap-3 border-b border-border/50 px-5 transition-colors hover:bg-muted/20"
            >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30 transition-all group-hover:ring-primary/50">
                    <ShieldCheck className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                    <p className="text-sm font-bold text-foreground leading-tight">System Management</p>
                    <p className="text-[10px] font-medium text-muted-foreground/60 leading-tight">Glanus Platform</p>
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
                <p className="mt-0.5 text-[10px] text-muted-foreground/60">All tenant data is visible</p>
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
                                    ? 'bg-primary/10 text-primary shadow-inner shadow-primary/5'
                                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                            ].join(' ')}
                        >
                            <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-muted-foreground'}`} />
                            {label}
                            {active && <ChevronRight className="ml-auto h-3 w-3 text-primary/50" />}
                        </Link>
                    );
                })}
            </nav>

            {/* Sidebar footer */}
            <div className="shrink-0 border-t border-border/50 p-3 space-y-1">
                <div className="flex items-center gap-2.5 rounded-xl px-3 py-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
                        {(session?.user?.name?.[0] || session?.user?.email?.[0] || 'A').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{session?.user?.name || 'Admin'}</p>
                        <p className="text-[10px] text-muted-foreground/60 truncate">{session?.user?.email}</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
