'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/lib/workspace/context';
import { NotificationPopover } from '@/components/workspace/NotificationPopover';
import { CommandPalette } from '@/components/workspace/CommandPalette';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Search, LogOut, Settings, Menu, X, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { hexToTailwindHsl } from '@/lib/utils/colors';

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
    const { data: session } = useSession();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    // Persist collapse state
    useEffect(() => {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('sidebar-collapsed') : null;
        if (stored === 'true') setCollapsed(true);
    }, []);

    const toggleCollapsed = useCallback(() => {
        setCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('sidebar-collapsed', String(next));
            return next;
        });
    }, []);

    // Close mobile sidebar on navigation
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    if (!workspace) return <>{children}</>;

    const basePath = `/workspaces`;

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
            href: `${basePath}/manage`,
            label: 'Admin Management',
            section: 'Workspace',
            icon: (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
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

    const activeNavItem = navItems.find(item => isActive(item.href));
    const activeSection = activeNavItem?.section;

    const userInitial = (
        session?.user?.name?.[0] ||
        session?.user?.email?.[0] ||
        'U'
    ).toUpperCase();

    /* ─────────────────────────────────────────
       Sidebar content (shared between mobile + desktop)
    ───────────────────────────────────────── */
    const sidebarContent = (
        <div className="flex h-full flex-col overflow-hidden">

            {/* Brand header */}
            <div className={`flex h-14 shrink-0 items-center border-b border-border/60 ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-4'}`}>
                <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0" aria-label="Glanus home">
                    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="shrink-0">
                        <path d="M10 6C6.134 6 3 9.134 3 13s3.134 7 7 7"
                            stroke="hsl(166,84%,39%)" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M22 26c3.866 0 7-3.134 7-7s-3.134-7-7-7"
                            stroke="hsl(166,84%,39%)" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="16" cy="16" r="2.5" fill="hsl(166,84%,39%)" opacity="0.5" />
                    </svg>
                    {!collapsed && (
                        <span className="text-sm font-bold tracking-tight text-foreground truncate">Glanus</span>
                    )}
                </Link>
            </div>

            {/* Workspace switcher */}
            {!collapsed && (
                <div className="shrink-0 border-b border-border/40 px-3 py-3">
                    <WorkspaceSwitcher />
                </div>
            )}

            {/* Search shortcut */}
            <div className={`shrink-0 pt-3 pb-1.5 ${collapsed ? 'px-2 flex justify-center' : 'px-3'}`}>
                {collapsed ? (
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
                        title="Search (⌘K)"
                        aria-label="Search"
                    >
                        <Search className="h-3.5 w-3.5 shrink-0" />
                    </button>
                ) : (
                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                    className="flex w-full items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground transition-all hover:border-primary/25 hover:bg-accent/50 hover:text-foreground"
                >
                    <Search className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 text-left">Search…</span>
                    <kbd className="hidden rounded-md border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">⌘K</kbd>
                </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin" aria-label="Workspace navigation"
                style={{ paddingLeft: collapsed ? 0 : undefined, paddingRight: collapsed ? 0 : undefined }}
            >
                {Object.entries(sections).map(([section, items]) => (
                    <div key={section} className={`mb-4 ${collapsed ? '' : ''}`}>
                        {!collapsed && (
                            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                                {section}
                            </p>
                        )}
                        {collapsed && (
                            <div className="mx-3 mb-1.5 h-px bg-border/40" aria-hidden="true" />
                        )}
                        <div className={`space-y-0.5 ${collapsed ? 'px-1.5' : ''}`}>
                            {items.map(item => {
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={[
                                            'sidebar-nav-item flex items-center rounded-xl text-sm transition-all duration-150',
                                            collapsed ? 'justify-center p-0 h-10 w-full' : 'gap-3 py-2 px-3',
                                            active
                                                ? 'text-primary bg-primary/8 font-semibold'
                                                : 'text-muted-foreground bg-transparent hover:bg-accent hover:text-foreground',
                                        ].join(' ')}
                                        title={collapsed ? item.label : undefined}
                                    >
                                        <span className={collapsed ? '' : 'shrink-0 opacity-80'}>
                                            {item.icon}
                                        </span>
                                        {!collapsed && <span>{item.label}</span>}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            
            {/* User footer */}
            <div className="shrink-0 border-t border-border/40 bg-surface-0">
                {/* Collapse button */}
                <div className={`flex items-center px-4 py-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                    {!collapsed && (
                        <p className="text-xs text-muted-foreground/50 font-medium">
                            Glanus v3.0
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="flex h-7 w-7 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed
                            ? <PanelLeftOpen className="h-4 w-4" />
                            : <PanelLeftClose className="h-4 w-4" />
                        }
                    </button>
                </div>
            </div>
        </div>
    );
    const primaryHsl = hexToTailwindHsl(workspace.primaryColor || '#00E5C8') || '168 100% 45%';
    const accentHsl = hexToTailwindHsl(workspace.accentColor || '#14b8a6') || '168 100% 30%';

    const dynamicStyles = {
        '--primary': primaryHsl,
        '--nerve': primaryHsl,
        '--ring': primaryHsl,
        '--sidebar-ring': primaryHsl,
        '--accent': accentHsl,
        '--cortex': accentHsl,
    } as React.CSSProperties;

    return (
        <div style={dynamicStyles} className="flex min-h-screen bg-background text-foreground">

            {/* Mobile hamburger */}
            <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-md transition-all hover:bg-accent hover:text-foreground hover:shadow-lg lg:hidden"
                aria-label="Open navigation"
            >
                <Menu className="h-4.5 w-4.5" />
            </button>

            {/* Mobile sidebar overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
                    <div
                        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
                        onClick={() => setMobileOpen(false)}
                    />
                    <aside className="relative z-10 h-full w-[260px] bg-card border-r border-border shadow-2xl animate-slide-in">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(false)}
                            className="absolute right-3 top-3.5 flex h-7 w-7 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            aria-label="Close navigation"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        {sidebarContent}
                    </aside>
                </div>
            )}

            {/* Desktop sidebar — collapsible */}
            <aside
                className={[
                    'hidden border-r border-border bg-card lg:flex lg:flex-col sidebar-collapse-transition z-50 fixed inset-y-0 left-0',
                    collapsed ? 'w-[72px]' : 'w-64',
                ].join(' ')}
            >
                {sidebarContent}
            </aside>

            {/* Main column */}
            <div className={[
                "flex flex-1 min-w-0 flex-col transition-all",
                collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'
            ].join(' ')}>

                {/* Top header */}
                <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-1.5 min-w-0 text-sm" aria-label="Breadcrumb">
                        <span className="text-muted-foreground/50 font-medium hidden sm:block shrink-0 text-xs">
                            {workspace?.name}
                        </span>
                        {activeSection && (
                            <>
                                <ChevronRight className="h-3 w-3 text-muted-foreground/30 hidden sm:block shrink-0" />
                                <span className="text-muted-foreground/50 hidden sm:block shrink-0 text-xs">
                                    {activeSection}
                                </span>
                            </>
                        )}
                        {activeNavItem && (
                            <>
                                <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                                <span className="text-sm font-semibold text-foreground truncate">
                                    {activeNavItem.label}
                                </span>
                            </>
                        )}
                    </nav>

                    {/* Right controls */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/25 hover:bg-accent/50 hover:text-foreground"
                            aria-label="Search"
                        >
                            <Search className="h-3 w-3" />
                            <span>Search</span>
                            <kbd className="rounded-md border border-border bg-surface-1 px-1 py-0.5 font-mono text-[10px]">⌘K</kbd>
                        </button>
                        <ThemeToggle />
                        <NotificationPopover />
                        
                        {/* User Menu Dropdown */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                onBlur={() => setTimeout(() => setUserMenuOpen(false), 150)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/15 text-xs font-bold text-primary transition-all hover:bg-primary/20 hover:shadow-sm ml-1"
                                aria-expanded={userMenuOpen}
                                aria-label="User menu"
                            >
                                {userInitial}
                            </button>
                            
                            {userMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-border bg-card animate-slide-up z-50"
                                     style={{ boxShadow: 'var(--shadow-xl)' }}>
                                    <div className="px-4 py-3 border-b border-border text-left">
                                        <p className="text-sm font-semibold text-foreground truncate">
                                            {session?.user?.name || 'Account'}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                            {session?.user?.email || ''}
                                        </p>
                                    </div>
                                    <div className="p-1.5">
                                        <Link href="/account" className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground rounded-xl hover:bg-accent transition-colors">
                                            <Settings className="h-4 w-4 text-muted-foreground" />
                                            Account Settings
                                        </Link>
                                    </div>
                                    <div className="p-1.5 border-t border-border">
                                        <button
                                            type="button"
                                            onClick={() => signOut({ callbackUrl: '/login' })}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive rounded-xl hover:bg-destructive/8 transition-colors"
                                        >
                                            <LogOut className="h-4 w-4 text-destructive/70" />
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto scrollbar-thin">
                    <div key={workspace?.id || 'loading-workspace'} className="px-6 py-6 lg:px-8 lg:py-8 animate-fade-in">
                        {children}
                    </div>
                    <CommandPalette />
                </main>
            </div>
        </div>
    );
}

    