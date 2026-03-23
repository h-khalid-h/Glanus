'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { Search, Server, Cpu, Brain, FileText, ArrowRight, Command } from 'lucide-react';

interface SearchResult {
    assets: Array<{
        id: string;
        name: string;
        assetType: string;
        status: string;
        serialNumber: string | null;
        category: { name: string } | null;
    }>;
    agents: Array<{
        id: string;
        hostname: string;
        platform: string;
        status: string;
        ipAddress: string | null;
        asset: { id: string; name: string } | null;
    }>;
    insights: Array<{
        id: string;
        title: string;
        type: string;
        severity: string | null;
        createdAt: string;
        asset: { id: string; name: string } | null;
    }>;
}

export function CommandPalette() {
    const router = useRouter();
    const params = useParams();
    const workspaceId = params?.id as string;

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Keyboard shortcut: Ctrl+K or Cmd+K
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setQuery('');
            setResults(null);
            setSelectedIndex(0);
        }
    }, [open]);

    // Debounced search
    const performSearch = useCallback(async (q: string) => {
        if (!workspaceId || q.length < 2) {
            setResults(null);
            return;
        }
        setLoading(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(q)}&limit=5`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.data || null);
                setSelectedIndex(0);
            }
        } catch {
            // Silently fail — command palette is non-critical
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    const handleQueryChange = (value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => performSearch(value), 200);
    };

    // Build flat item list for keyboard nav
    const allItems: Array<{ type: string; id: string; label: string; sub: string; href: string }> = [];
    if (results) {
        results.assets.forEach(a => allItems.push({
            type: 'asset',
            id: a.id,
            label: a.name,
            sub: `${a.category?.name || a.assetType} • ${a.status}`,
            href: `/assets/${a.id}`,
        }));
        results.agents.forEach(a => allItems.push({
            type: 'agent',
            id: a.id,
            label: a.hostname,
            sub: `${a.platform} • ${a.status} • ${a.ipAddress || 'No IP'}`,
            href: `/workspaces/${workspaceId}/agents/${a.id}`,
        }));
        results.insights.forEach(i => allItems.push({
            type: 'insight',
            id: i.id,
            label: i.title,
            sub: `${i.type} • ${i.severity || 'info'}`,
            href: `/workspaces/${workspaceId}/intelligence`,
        }));
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && allItems[selectedIndex]) {
            e.preventDefault();
            router.push(allItems[selectedIndex].href);
            setOpen(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'asset': return <Server size={16} className="text-nerve" />;
            case 'agent': return <Cpu size={16} className="text-blue-400" />;
            case 'insight': return <Brain size={16} className="text-purple-400" />;
            default: return <FileText size={16} className="text-slate-400" />;
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

            {/* Palette */}
            <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="Command Palette">
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                    <Search size={18} className={loading ? 'text-nerve animate-pulse' : 'text-slate-500'} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => handleQueryChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-slate-500"
                        placeholder="Search assets, agents, insights…"
                    />
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-800 border border-slate-700">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto">
                    {query.length > 0 && query.length < 2 && (
                        <div className="px-4 py-6 text-center text-sm text-slate-500">
                            Type at least 2 characters to search…
                        </div>
                    )}

                    {query.length >= 2 && !loading && allItems.length === 0 && results && (
                        <div className="px-4 py-6 text-center text-sm text-slate-500">
                            No results found for &ldquo;{query}&rdquo;
                        </div>
                    )}

                    {allItems.length > 0 && (
                        <div className="py-2">
                            {/* Group headers */}
                            {results && results.assets.length > 0 && (
                                <>
                                    <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Assets</div>
                                    {results.assets.map((a, i) => {
                                        const idx = i;
                                        return (
                                            <button
                                                key={a.id}
                                                onClick={() => { router.push(`/assets/${a.id}`); setOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${selectedIndex === idx ? 'bg-nerve/10 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                                            >
                                                {getIcon('asset')}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">{a.name}</div>
                                                    <div className="text-xs text-slate-500">{a.category?.name || a.assetType} • {a.status}</div>
                                                </div>
                                                <ArrowRight size={14} className="text-slate-600 shrink-0" />
                                            </button>
                                        );
                                    })}
                                </>
                            )}

                            {results && results.agents.length > 0 && (
                                <>
                                    <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Agents</div>
                                    {results.agents.map((a, i) => {
                                        const idx = (results?.assets.length || 0) + i;
                                        return (
                                            <button
                                                key={a.id}
                                                onClick={() => { router.push(`/workspaces/${workspaceId}/agents/${a.id}`); setOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${selectedIndex === idx ? 'bg-nerve/10 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                                            >
                                                {getIcon('agent')}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">{a.hostname}</div>
                                                    <div className="text-xs text-slate-500">{a.platform} • {a.status} • {a.ipAddress || 'No IP'}</div>
                                                </div>
                                                <ArrowRight size={14} className="text-slate-600 shrink-0" />
                                            </button>
                                        );
                                    })}
                                </>
                            )}

                            {results && results.insights.length > 0 && (
                                <>
                                    <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Insights</div>
                                    {results.insights.map((ins, i) => {
                                        const idx = (results?.assets.length || 0) + (results?.agents.length || 0) + i;
                                        return (
                                            <button
                                                key={ins.id}
                                                onClick={() => { router.push(`/workspaces/${workspaceId}/intelligence`); setOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${selectedIndex === idx ? 'bg-nerve/10 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                                            >
                                                {getIcon('insight')}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">{ins.title}</div>
                                                    <div className="text-xs text-slate-500">{ins.type} • {ins.severity || 'info'}</div>
                                                </div>
                                                <ArrowRight size={14} className="text-slate-600 shrink-0" />
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-slate-800 border border-slate-700">↑↓</kbd> navigate</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-slate-800 border border-slate-700">↵</kbd> open</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-slate-800 border border-slate-700">esc</kbd> close</span>
                    </div>
                    <span className="flex items-center gap-1">
                        <Command size={10} />
                        Powered by Glanus Search
                    </span>
                </div>
            </div>
        </div>
    );
}
