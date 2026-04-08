'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, History, Activity as ActivityIcon, Settings, Shield, Tags } from 'lucide-react';

export default function AdminManagementLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const tabs = [
        { name: 'Team Management', href: '/workspaces/manage/members', icon: Users },
        { name: 'Audit Logs', href: '/workspaces/manage/audit', icon: History },
        { name: 'Activity Feed', href: '/workspaces/manage/activity', icon: ActivityIcon },
        { name: 'Asset Categories', href: '/workspaces/manage/categories', icon: Tags },
        { name: 'Workspace Settings', href: '/workspaces/manage/settings', icon: Settings },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
            <div className="flex items-center gap-3 border-b border-border/50 pb-5 mb-2">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                    <Shield className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin Management</h1>
                    <p className="text-sm text-muted-foreground mt-1">Configure workspace settings, manage team access, and monitor platform activity.</p>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="inline-flex h-11 items-center justify-center rounded-xl bg-surface-container-low/50 p-1 border border-slate-800/40 w-fit">
                {tabs.map(tab => {
                    const isActive = pathname.startsWith(tab.href);
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                                isActive 
                                    ? 'bg-surface-1 text-primary shadow-sm border border-slate-700/50 text-foreground' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2/30'
                            }`}
                        >
                            <tab.icon className={`mr-2 h-4 w-4 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                            {tab.name}
                        </Link>
                    )
                })}
            </div>

            <div className="mt-6">
                {children}
            </div>
        </div>
    );
}
