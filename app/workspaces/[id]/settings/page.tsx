'use client';

import { useState, useEffect, use } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { Settings, Palette, AlertTriangle, Users, CreditCard } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import GeneralSettings from '@/components/workspace/settings/GeneralSettings';
import BrandingSettings from '@/components/workspace/settings/BrandingSettings';
import DangerZone from '@/components/workspace/settings/DangerZone';

export default function WorkspaceSettingsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = use(paramsPromise);
    const { currentWorkspace, setCurrentWorkspaceById, fetchWorkspaces } = useWorkspaceStore();
    const [activeTab, setActiveTab] = useState('general');

    useEffect(() => {
        if (!currentWorkspace || currentWorkspace.id !== params.id) {
            fetchWorkspaces().then(() => {
                setCurrentWorkspaceById(params.id);
            });
        }
    }, [params.id, currentWorkspace, setCurrentWorkspaceById, fetchWorkspaces]);

    if (!currentWorkspace) {
        return (
            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="mb-8 space-y-2">
                    <div className="h-7 w-52 animate-pulse rounded-lg bg-surface-2" />
                    <div className="h-4 w-80 animate-pulse rounded bg-surface-2" />
                </div>
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="w-full md:w-64 shrink-0 space-y-2">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-2" />
                        ))}
                    </div>
                    <div className="flex-1">
                        <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
                    </div>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'general', label: 'General', icon: Settings, component: GeneralSettings },
        { id: 'branding', label: 'Branding', icon: Palette, component: BrandingSettings },
        { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, component: DangerZone, variant: 'danger' },
    ];

    const navLinks = [
        { label: 'Members', icon: Users, href: `/workspaces/${params.id}/members` },
        { label: 'Billing', icon: CreditCard, href: `/workspaces/${params.id}/billing` },
    ];

    const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || GeneralSettings;

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Workspace Settings</h1>
                <p className="text-slate-500 mt-1">
                    Manage your workspace preferences and configuration.
                </p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Tabs */}
                <div className="w-full md:w-64 shrink-0 space-y-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        const isDanger = tab.variant === 'danger';

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                    isActive
                                        ? isDanger
                                            ? 'bg-health-critical/10 text-health-critical'
                                            : 'bg-nerve/5 text-nerve'
                                        : isDanger
                                            ? 'text-health-critical hover:bg-health-critical/10'
                                            : 'text-slate-600 hover:bg-slate-800'
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}

                    {/* Navigation Links to other pages */}
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-1">
                        {navLinks.map((link) => {
                            const Icon = link.icon;
                            return (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-800 transition-colors"
                                >
                                    <Icon className="w-4 h-4" />
                                    {link.label}
                                    <svg className="w-3.5 h-3.5 ml-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                    </svg>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl shadow-sm border border-slate-800 p-6 animate-in fade-in duration-300">
                        <ActiveComponent workspace={currentWorkspace} />
                    </div>
                </div>
            </div>
        </div>
    );
}
