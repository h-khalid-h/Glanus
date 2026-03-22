'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/lib/workspace/context';
import { NotificationPopover } from '@/components/workspace/NotificationPopover';
import { CommandPalette } from '@/components/workspace/CommandPalette';
import { Search, User } from 'lucide-react';

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
    section: string;
}

/**
 * Adaptive workspace sidebar layout.
 * Navigation adapts based on workspace size — hides complexity for smaller workspaces.
 */
export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { workspace } = useWorkspace();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close mobile sidebar on navigation
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    if (!workspace) return <>{children}</>;

    const workspaceId = workspace.id;
    const basePath = `/workspaces/${workspaceId}`;

    const navItems: NavItem[] = [
        {
            href: `${basePath}/analytics`,
            label: 'Mission Control',
            section: 'Overview',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
            ),
        },
        {
            href: `/assets`,
            label: 'Asset Inventory',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/agents`,
            label: 'Agents',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/alerts`,
            label: 'Alerts',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
            ),
        },
        {
            href: `${basePath}/intelligence`,
            label: 'Intelligence',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715l-.002-.001a1.125 1.125 0 00-.218-.218l-.001-.002-.003.002a1.125 1.125 0 00-.218.218l-.002.001.002.003c.052.07.115.133.218.218l.001.002.003-.002a1.125 1.125 0 00.218-.218l.002-.003z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/mdm`,
            label: 'MDM Profiles',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
            ),
        },
        {
            href: `${basePath}/reflex`,
            label: 'Reflex Engine',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
            ),
        },
        {
            href: `${basePath}/patches`,
            label: 'Patch Management',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/scripts`,
            label: 'Script Library',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/network`,
            label: 'Network Discovery',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/helpdesk`,
            label: 'Support Tickets',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 01.106-.01L12.5 11.25m-1.5 0a.75.75 0 00-.106.01l-.041.02m1.647 0A.75.75 0 0112.5 11.25m-1.5 0a.75.75 0 00.106.01L11.25 11.25m0 0A.75.75 0 0110.5 12v3a2.25 2.25 0 002.25 2.25h1.5A2.25 2.25 0 0016.5 15v-3a.75.75 0 00-.75-.75h-1.5A.75.75 0 0013.5 12v3a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-3a.75.75 0 00-.25-.5l-3-3a1.5 1.5 0 010-2.121l1.5-1.5a1.5 1.5 0 012.121 0l3 3A1.5 1.5 0 0115 8.25v2.25z" />
                </svg>
            )
        },
        {
            href: `${basePath}/reports`,
            label: 'Reports',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/members`,
            label: 'Team',
            section: 'Workspace',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/audit`,
            label: 'Audit Logs',
            section: 'Workspace',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/notifications`,
            label: 'Notifications',
            section: 'Workspace',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
            ),
        },
        {
            href: `${basePath}/partner`,
            label: 'IT Partner Match',
            section: 'Workspace',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.83-5.83m0 0l2.58-2.58a2 2 0 000-2.83l-1.42-1.42a2 2 0 00-2.83 0l-2.58 2.58m5.83 5.83L11.42 15.17m-6.59-6.59l2.58-2.58a2 2 0 012.83 0l1.42 1.42a2 2 0 010 2.83l-2.58 2.58m-5.83-5.83L8.83 8.83m-6.59 6.59L4.83 8.83m-2.58 2.58a2 2 0 000 2.83l1.42 1.42a2 2 0 002.83 0m0 0l-2.58-2.58m0 0l2.58 2.58m0 0l-2.58 2.58" />
                </svg>
            ),
        },
        {
            href: `${basePath}/activity`,
            label: 'Activity Feed',
            section: 'Workspace',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/maintenance`,
            label: 'Maintenance',
            section: 'Workspace',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/billing`,
            label: 'Billing',
            section: 'Workspace',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/remote`,
            label: 'Remote Desktop',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/download-agent`,
            label: 'Agent Installer',
            section: 'Operations',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
            ),
        },
        {
            href: `${basePath}/settings`,
            label: 'Settings',
            section: 'Workspace',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
        },
        {
            href: `${basePath}/webhooks`,
            label: 'Webhooks',
            section: 'Workspace',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
            ),
        },
    ];

    // Group by section
    const sections = navItems.reduce<Record<string, NavItem[]>>((acc, item) => {
        if (!acc[item.section]) acc[item.section] = [];
        acc[item.section].push(item);
        return acc;
    }, {});

    const isActive = (href: string) => {
        if (href === `${basePath}/analytics`) {
            return pathname === `${basePath}/analytics` || pathname === basePath;
        }
        return pathname.startsWith(href);
    };

    const sidebarContent = (
        <div className="flex h-full flex-col">
            {/* Workspace header */}
            <div className="border-b border-border px-4 py-4">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nerve/10 text-sm font-bold text-nerve">
                        {workspace.name?.charAt(0)?.toUpperCase() || 'W'}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{workspace.name}</p>
                        <p className="text-2xs text-muted-foreground capitalize">
                            {workspace.subscription?.plan?.toLowerCase() || 'free'} plan
                        </p>
                    </div>
                </div>
            </div>

            {/* Search shortcut hint */}
            <div className="px-4 pb-3">
                <button
                    onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                    className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-nerve/30 hover:text-foreground transition"
                >
                    <Search size={13} />
                    <span className="flex-1 text-left">Search…</span>
                    <kbd className="hidden sm:inline-block rounded border border-border bg-surface-1 px-1 py-0.5 text-[10px] font-mono">⌘K</kbd>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4">
                {Object.entries(sections).map(([section, items]) => (
                    <div key={section} className="mb-4">
                        <p className="mb-1.5 px-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground/60">
                            {section}
                        </p>
                        <div className="space-y-0.5">
                            {items.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${isActive(item.href)
                                        ? 'bg-nerve/10 font-medium text-nerve'
                                        : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                                        }`}
                                >
                                    {item.icon}
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="border-t border-border px-4 py-3">
                <p className="text-2xs text-muted-foreground/40">
                    Glanus v2.0 · PRISM
                </p>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen">
            {/* Mobile hamburger button */}
            <button type="button"
                onClick={() => setMobileOpen(true)}
                className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground lg:hidden"
                aria-label="Open navigation"
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            </button>

            {/* Mobile sidebar overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setMobileOpen(false)}
                    />
                    {/* Sidebar */}
                    <aside className="relative z-10 h-full w-64 bg-surface-1 shadow-xl animate-slide-in">
                        <button type="button"
                            onClick={() => setMobileOpen(false)}
                            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                            aria-label="Close navigation"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        {sidebarContent}
                    </aside>
                </div>
            )}

            {/* Desktop Sidebar */}
            <aside className="hidden w-56 shrink-0 border-r border-border bg-surface-1 lg:block">
                {sidebarContent}
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto relative">
                {/* Global Top Header */}
                <header className="sticky top-0 z-30 flex h-14 items-center justify-end border-b border-border bg-surface-1/80 px-6 backdrop-blur">
                    <div className="flex items-center gap-4">
                        <Link href="/account" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
                            <User size={14} />
                            Account
                        </Link>
                        <NotificationPopover />
                    </div>
                </header>

                <div className="mx-auto max-w-7xl px-6 py-6">
                    {children}
                </div>
                <CommandPalette />
            </main>
        </div>
    );
}

