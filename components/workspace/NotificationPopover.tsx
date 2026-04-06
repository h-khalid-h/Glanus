'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useWorkspace } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';

export interface BaseNotification {
    id: string;
    type: 'AUDIT_LOG' | 'AI_INSIGHT';
    title: string;
    createdAt: string;
    description?: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    confidence?: number;
    metadata?: Record<string, unknown> | null;
}

export function NotificationPopover() {
    const { workspace } = useWorkspace();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<BaseNotification[]>([]);
    const [hasUnread, setHasUnread] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close logic when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        if (!workspace?.id) return;
        setIsLoading(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspace.id}/notifications?limit=5`);
            if (res.ok) {
                const data = await res.json();
                const fetched: BaseNotification[] = data.data?.notifications || [];
                setNotifications(fetched);

                // Extremely simple unread check logic - check if there's any Critical/Warning traces locally
                const containsCritical = fetched.some(n => n.severity === 'CRITICAL' || n.severity === 'WARNING');
                setHasUnread(containsCritical);
            }
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Load instantly once on mount to determine unread badge logic
    useEffect(() => {
        fetchNotifications();
        // Option: Setup a polling interval if high real-time sensitivity is needed
    }, [workspace?.id]);

    return (
        <div className="relative" ref={popoverRef}>
            <button
                type="button"
                className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) { fetchNotifications(); setHasUnread(false); }
                }}
                aria-label="Notifications"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>

                {hasUnread && (
                    <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-oracle opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-oracle"></span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 animate-in fade-in slide-in-from-top-2 overflow-hidden rounded-xl border border-border bg-surface-1 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border bg-surface-2/50 px-4 py-3">
                        <h3 className="text-sm font-semibold">Notifications</h3>
                    </div>

                    <div className="max-h-96 overflow-y-auto p-2 scrollbar-thin">
                        {isLoading && notifications.length === 0 ? (
                            <div className="flex items-center justify-center p-4">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-nerve border-t-transparent"></div>
                            </div>
                        ) : notifications.length > 0 ? (
                            <div className="flex flex-col gap-1">
                                {notifications.map((notif) => (
                                    <div key={notif.id} className="flex gap-3 rounded-lg p-2 hover:bg-surface-2 transition-colors">
                                        <div className="mt-0.5 shrink-0">
                                            {notif.type === 'AI_INSIGHT' ? (
                                                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${notif.severity === 'CRITICAL' ? 'bg-oracle/20 text-oracle' :
                                                    notif.severity === 'WARNING' ? 'bg-amber-500/20 text-amber-500' : 'bg-cortex/20 text-cortex'
                                                    }`}>
                                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                                    </svg>
                                                </div>
                                            ) : (
                                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-2 text-muted-foreground">
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-tight text-foreground">
                                                {notif.type === 'AI_INSIGHT' ? <span className="text-xs uppercase mr-1.5 font-bold tracking-wider text-nerve">NERVE</span> : null}
                                                {notif.title}
                                            </p>
                                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                {notif.description || (notif.metadata as any)?.description || "System trace."}
                                            </p>
                                            <p className="mt-1.5 text-2xs text-muted-foreground/60">
                                                {new Date(notif.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-4 py-8 text-center">
                                <p className="text-sm text-muted-foreground">No recent activity found.</p>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-border bg-surface-2 p-2">
                        <Link
                            href={`/workspaces/notifications`}
                            onClick={() => setIsOpen(false)}
                            className="flex w-full items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-nerve hover:bg-nerve/10 transition-colors"
                        >
                            View All Events
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
