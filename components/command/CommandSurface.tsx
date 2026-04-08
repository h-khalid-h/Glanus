'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useWorkspace } from '@/lib/workspace/context';

interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    category: 'navigation' | 'action' | 'query';
    handler: () => void;
    keywords?: string[];
}

interface AICommandResult {
    type: 'navigate' | 'query' | 'explain' | 'execute';
    path?: string;
    label?: string;
    summary?: string;
    detail?: string;
    topic?: string;
    requiresConfirmation?: boolean;
}

interface SearchAsset {
    id: string;
    name: string;
    assetType: string;
    status: string;
    serialNumber: string | null;
    category: { name: string } | null;
}

interface SearchAgent {
    id: string;
    hostname: string;
    platform: string;
    status: string;
    ipAddress: string | null;
    asset: { id: string; name: string };
}

interface SearchInsight {
    id: string;
    title: string;
    type: string;
    severity: string | null;
    confidence: number | null;
    acknowledged: boolean;
    createdAt: string;
    asset: { id: string; name: string } | null;
}

interface SearchResults {
    assets: SearchAsset[];
    agents: SearchAgent[];
    insights: SearchInsight[];
}

export function CommandSurface() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [aiResult, setAiResult] = useState<AICommandResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const router = useRouter();
    const pathname = usePathname();
    const { workspace } = useWorkspace();

    const workspaceId = workspace?.id;

    // Define command items
    const commands: CommandItem[] = React.useMemo(() => {
        const base: CommandItem[] = [
            {
                id: 'nav-dashboard',
                label: 'Go to Dashboard',
                description: 'View your workspaces overview',
                icon: <HomeIcon />,
                category: 'navigation',
                handler: () => router.push('/dashboard'),
                keywords: ['home', 'main', 'overview'],
            },
        ];

        if (workspaceId) {
            base.push(
                {
                    id: 'nav-mission',
                    label: 'Mission Control',
                    description: 'Workspace overview and health',
                    icon: <ChartIcon />,
                    category: 'navigation',
                    handler: () => router.push(`/workspaces/analytics`),
                    keywords: ['analytics', 'metrics', 'stats', 'reliability'],
                },
                {
                    id: 'nav-assets',
                    label: 'View Assets',
                    description: 'Browse infrastructure assets',
                    icon: <ServerIcon />,
                    category: 'navigation',
                    handler: () => router.push('/assets'),
                    keywords: ['servers', 'devices', 'hardware', 'inventory'],
                },
                {
                    id: 'nav-agents',
                    label: 'View Agents',
                    description: 'Monitor connected agents',
                    icon: <CpuIcon />,
                    category: 'navigation',
                    handler: () => router.push(`/workspaces/agents`),
                    keywords: ['monitoring', 'endpoints', 'rmm', 'connections'],
                },
                {
                    id: 'nav-alerts',
                    label: 'View Alerts',
                    description: 'Check active alert rules',
                    icon: <BellIcon />,
                    category: 'navigation',
                    handler: () => router.push(`/workspaces/alerts`),
                    keywords: ['warnings', 'notifications', 'monitor'],
                },
                {
                    id: 'nav-settings',
                    label: 'Workspace Settings',
                    description: 'Configure workspace preferences',
                    icon: <SettingsIcon />,
                    category: 'navigation',
                    handler: () => router.push(`/workspaces/manage/settings`),
                    keywords: ['config', 'preferences', 'account'],
                },
                {
                    id: 'nav-members',
                    label: 'Manage Members',
                    description: 'Invite and manage team members',
                    icon: <UsersIcon />,
                    category: 'navigation',
                    handler: () => router.push(`/workspaces/manage/members`),
                    keywords: ['team', 'users', 'invite', 'people'],
                },
                {
                    id: 'nav-billing',
                    label: 'Billing & Subscription',
                    description: 'Manage your plan and billing',
                    icon: <CreditCardIcon />,
                    category: 'navigation',
                    handler: () => router.push(`/workspaces/billing`),
                    keywords: ['payment', 'plan', 'upgrade', 'subscription'],
                },
            );
        }

        return base;
    }, [workspaceId, router]);

    // Filter commands based on query
    const filteredCommands = React.useMemo(() => {
        if (!query.trim()) return commands;
        const lower = query.toLowerCase();
        return commands.filter(cmd =>
            cmd.label.toLowerCase().includes(lower) ||
            cmd.description?.toLowerCase().includes(lower) ||
            cmd.keywords?.some(k => k.includes(lower))
        );
    }, [commands, query]);

    // Debounced live entity search
    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        const trimmed = query.trim();
        if (trimmed.length < 2 || !workspaceId) {
            setSearchResults(null);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        searchTimerRef.current = setTimeout(async () => {
            try {
                const res = await csrfFetch(`/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(trimmed)}&limit=5`);
                if (res.ok) {
                    const json = await res.json();
                    setSearchResults(json.data || null);
                }
            } catch {
                setSearchResults(null);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [query, workspaceId]);

    // Count total entity results for keyboard nav
    const entityResultCount = (searchResults?.assets?.length || 0) + (searchResults?.agents?.length || 0) + (searchResults?.insights?.length || 0);
    const totalSelectableCount = filteredCommands.length + entityResultCount;

    // Determine if input looks like a natural language query (not a simple keyword match)
    const isNaturalLanguage = query.trim().split(' ').length >= 3 && filteredCommands.length === 0 && entityResultCount === 0;

    // Reset active index when filter changes
    useEffect(() => {
        setActiveIndex(0);
        setAiResult(null);
    }, [filteredCommands.length, entityResultCount]);

    // Keyboard shortcut to open
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            if (e.key === 'Escape' && open) {
                e.preventDefault();
                setOpen(false);
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setQuery('');
            setActiveIndex(0);
            setAiResult(null);
            setIsProcessing(false);
            const timer = setTimeout(() => inputRef.current?.focus(), 50);
            return () => clearTimeout(timer);
        }
    }, [open]);

    // AI command processing
    const processAICommand = useCallback(async () => {
        if (!query.trim() || isProcessing) return;

        setIsProcessing(true);
        setAiResult(null);

        try {
            const res = await csrfFetch('/api/ai/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: query,
                    workspaceId,
                    currentPath: pathname,
                }),
            });

            if (res.ok) {
                const result = await res.json();
                const data = result.data || result;
                setAiResult(data);

                // Auto-navigate if it's a navigation result
                if (data.type === 'navigate' && data.path) {
                    router.push(data.path);
                    setOpen(false);
                }
            }
        } catch {
            setAiResult({
                type: 'explain',
                topic: 'Error',
                detail: 'Unable to process command. Please try again.',
            });
        } finally {
            setIsProcessing(false);
        }
    }, [query, workspaceId, pathname, router, isProcessing]);

    // Handle keyboard navigation within the list
    // Build a flat handler array for keyboard navigation across both commands and entity results
    const entityHandlers = React.useMemo(() => {
        const handlers: (() => void)[] = [];
        if (searchResults?.assets) {
            for (const a of searchResults.assets) {
                handlers.push(() => { router.push(`/assets/${a.id}`); setOpen(false); });
            }
        }
        if (searchResults?.agents) {
            for (const _ag of searchResults.agents) {
                handlers.push(() => { router.push(`/workspaces/agents`); setOpen(false); });
            }
        }
        if (searchResults?.insights) {
            for (const _ins of searchResults.insights) {
                handlers.push(() => { router.push(`/workspaces/notifications`); setOpen(false); });
            }
        }
        return handlers;
    }, [searchResults, workspaceId, router]);

    const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => Math.min(prev + 1, totalSelectableCount - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();

            // If it looks like natural language, send to AI
            if (isNaturalLanguage || totalSelectableCount === 0) {
                processAICommand();
                return;
            }

            // Check if selecting a command or an entity result
            if (activeIndex < filteredCommands.length) {
                const item = filteredCommands[activeIndex];
                if (item) { item.handler(); setOpen(false); }
            } else {
                const entityIndex = activeIndex - filteredCommands.length;
                if (entityHandlers[entityIndex]) entityHandlers[entityIndex]();
            }
        }
    }, [filteredCommands, activeIndex, isNaturalLanguage, processAICommand, totalSelectableCount, entityHandlers]);

    // Scroll active item into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    if (!open) return null;

    return (
        <>
            {/* Overlay */}
            <div
                className="command-overlay"
                onClick={() => setOpen(false)}
            />

            {/* Dialog */}
            <div className="command-dialog">
                {/* Search input */}
                <div className="flex items-center gap-3 px-6 py-4">
                    {isProcessing ? (
                        <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-nerve border-t-transparent" />
                    ) : (
                        <svg className="h-5 w-5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    )}
                    <input
                        ref={inputRef}
                        type="text"
                        className="command-input"
                        placeholder="Search commands, navigate, or ask a question..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                    />
                    <span className="command-kbd">ESC</span>
                </div>

                {/* AI Result  */}
                {aiResult && (
                    <div className="mx-4 mb-3 rounded-xl border border-nerve/20 bg-nerve/5 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded bg-nerve/20 text-xs text-nerve">✦</span>
                            <span className="text-xs font-medium text-nerve uppercase tracking-wider">
                                {aiResult.type === 'explain' ? 'CORTEX' : aiResult.type === 'execute' ? 'REFLEX' : 'Glanus'}
                            </span>
                        </div>
                        <p className="text-sm text-foreground">
                            {aiResult.detail || aiResult.summary || aiResult.label || 'Processing...'}
                        </p>
                        {aiResult.type === 'execute' && aiResult.requiresConfirmation && (
                            <div className="mt-3 flex gap-2">
                                <button type="button"
                                    className="rounded-lg bg-reflex/10 px-3 py-1.5 text-xs font-medium text-reflex hover:bg-reflex/20 transition-colors"
                                    onClick={() => setOpen(false)}
                                >
                                    Confirm
                                </button>
                                <button type="button"
                                    className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => setAiResult(null)}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Results */}
                <div className="command-list scrollbar-thin" ref={listRef}>
                    {filteredCommands.length === 0 && entityResultCount === 0 && !aiResult ? (
                        <div className="px-6 py-8 text-center">
                            {isProcessing || isSearching ? (
                                <p className="text-sm text-muted-foreground">Searching...</p>
                            ) : (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        No matching commands for &quot;{query}&quot;
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground/60">
                                        Press <kbd className="command-kbd">↵</kbd> to ask Glanus AI
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Static commands grouped by category */}
                            {(['navigation', 'action', 'query'] as const).map(category => {
                                const items = filteredCommands.filter(c => c.category === category);
                                if (items.length === 0) return null;

                                const label = category === 'navigation' ? 'Navigate'
                                    : category === 'action' ? 'Actions' : 'Ask';

                                return (
                                    <div key={category}>
                                        <div className="px-6 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            {label}
                                        </div>
                                        {items.map(item => {
                                            const globalIndex = filteredCommands.indexOf(item);
                                            return (
                                                <div
                                                    key={item.id}
                                                    data-index={globalIndex}
                                                    data-active={globalIndex === activeIndex}
                                                    className="command-item"
                                                    onClick={() => {
                                                        item.handler();
                                                        setOpen(false);
                                                    }}
                                                    onMouseEnter={() => setActiveIndex(globalIndex)}
                                                >
                                                    <span className="text-muted-foreground shrink-0">
                                                        {item.icon}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium">{item.label}</div>
                                                        {item.description && (
                                                            <div className="text-xs text-muted-foreground truncate">
                                                                {item.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}

                            {/* ── Live Entity Search Results ── */}
                            {(() => {
                                let entityIdx = filteredCommands.length;
                                return (
                                    <>
                                        {/* Assets */}
                                        {searchResults?.assets && searchResults.assets.length > 0 && (
                                            <div>
                                                <div className="px-6 py-2 text-xs font-medium text-nerve uppercase tracking-wider flex items-center gap-1.5">
                                                    <ServerIcon /> Assets
                                                    {isSearching && <span className="h-2 w-2 animate-pulse rounded-full bg-nerve" />}
                                                </div>
                                                {searchResults.assets.map((asset) => {
                                                    const idx = entityIdx++;
                                                    return (
                                                        <div
                                                            key={`asset-${asset.id}`}
                                                            data-index={idx}
                                                            data-active={idx === activeIndex}
                                                            className="command-item"
                                                            onClick={() => { router.push(`/assets/${asset.id}`); setOpen(false); }}
                                                            onMouseEnter={() => setActiveIndex(idx)}
                                                        >
                                                            <span className="text-muted-foreground shrink-0"><ServerIcon /></span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-medium">{asset.name}</div>
                                                                <div className="text-xs text-muted-foreground truncate">
                                                                    {asset.category?.name || asset.assetType} · {asset.status}
                                                                    {asset.serialNumber ? ` · S/N ${asset.serialNumber}` : ''}
                                                                </div>
                                                            </div>
                                                            <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${asset.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-400' :
                                                                asset.status === 'ASSIGNED' ? 'bg-blue-500/10 text-blue-400' :
                                                                    'bg-slate-500/10 text-slate-400'
                                                                }`}>{asset.status}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Agents */}
                                        {searchResults?.agents && searchResults.agents.length > 0 && (
                                            <div>
                                                <div className="px-6 py-2 text-xs font-medium text-cortex uppercase tracking-wider flex items-center gap-1.5">
                                                    <CpuIcon /> Agents
                                                </div>
                                                {searchResults.agents.map((agent) => {
                                                    const idx = entityIdx++;
                                                    return (
                                                        <div
                                                            key={`agent-${agent.id}`}
                                                            data-index={idx}
                                                            data-active={idx === activeIndex}
                                                            className="command-item"
                                                            onClick={() => { router.push(`/workspaces/agents`); setOpen(false); }}
                                                            onMouseEnter={() => setActiveIndex(idx)}
                                                        >
                                                            <span className="text-muted-foreground shrink-0"><CpuIcon /></span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-medium">{agent.hostname}</div>
                                                                <div className="text-xs text-muted-foreground truncate">
                                                                    {agent.platform} · {agent.asset?.name || 'Unlinked'}
                                                                    {agent.ipAddress ? ` · ${agent.ipAddress}` : ''}
                                                                </div>
                                                            </div>
                                                            <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${agent.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400' :
                                                                agent.status === 'OFFLINE' ? 'bg-red-500/10 text-red-400' :
                                                                    'bg-amber-500/10 text-amber-400'
                                                                }`}>{agent.status}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* AI Insights */}
                                        {searchResults?.insights && searchResults.insights.length > 0 && (
                                            <div>
                                                <div className="px-6 py-2 text-xs font-medium text-oracle uppercase tracking-wider flex items-center gap-1.5">
                                                    <SparkleIcon /> Oracle Insights
                                                </div>
                                                {searchResults.insights.map((insight) => {
                                                    const idx = entityIdx++;
                                                    return (
                                                        <div
                                                            key={`insight-${insight.id}`}
                                                            data-index={idx}
                                                            data-active={idx === activeIndex}
                                                            className="command-item"
                                                            onClick={() => { router.push(`/workspaces/notifications`); setOpen(false); }}
                                                            onMouseEnter={() => setActiveIndex(idx)}
                                                        >
                                                            <span className="text-oracle shrink-0"><SparkleIcon /></span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-medium">{insight.title}</div>
                                                                <div className="text-xs text-muted-foreground truncate">
                                                                    {insight.type} · {insight.asset?.name || 'Workspace'}
                                                                    {insight.confidence ? ` · ${(insight.confidence * 100).toFixed(0)}% conf.` : ''}
                                                                </div>
                                                            </div>
                                                            <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${insight.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-400' :
                                                                insight.severity === 'WARNING' ? 'bg-amber-500/10 text-amber-400' :
                                                                    'bg-blue-500/10 text-blue-400'
                                                                }`}>{insight.severity || 'INFO'}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border px-6 py-2.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <span className="command-kbd">↑↓</span> Navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="command-kbd">↵</span> Select
                        </span>
                    </div>
                    <span className="flex items-center gap-1">
                        <span className="command-kbd">⌘</span>
                        <span className="command-kbd">K</span> Toggle
                    </span>
                </div>
            </div>
        </>
    );
}

/* ==========================================
   Inline icon components (lightweight SVGs)
   ========================================== */

function HomeIcon() {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
    );
}

function ServerIcon() {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 0 0-.12-1.03l-2.268-9.64a3.375 3.375 0 0 0-3.285-2.602H7.923a3.375 3.375 0 0 0-3.285 2.602l-2.268 9.64a4.5 4.5 0 0 0-.12 1.03v.228m19.5 0a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3m19.5 0a3 3 0 0 0-3-3H5.25a3 3 0 0 0-3 3m16.5 0h.008v.008h-.008v-.008Zm-3 0h.008v.008h-.008v-.008Z" />
        </svg>
    );
}

function CpuIcon() {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
        </svg>
    );
}

function BellIcon() {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
    );
}

function ChartIcon() {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
    );
}

function SettingsIcon() {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 0 1 0 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
    );
}

function UsersIcon() {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
    );
}

function CreditCardIcon() {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        </svg>
    );
}

function SparkleIcon() {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
        </svg>
    );
}

