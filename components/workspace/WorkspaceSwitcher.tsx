'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronDown as ChevronDownIcon, Check as CheckIcon, Plus as PlusIcon } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace/context';
import { useRouter } from 'next/navigation';

export function WorkspaceSwitcher() {
    const { workspace, workspaces, switchWorkspace, isLoading } = useWorkspace();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-xl animate-pulse">
                <div className="h-5 w-32 bg-muted rounded"></div>
            </div>
        );
    }

    if (!workspace) {
        return null;
    }

    return (
        <div className="relative" ref={menuRef}>
            <button type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-card backdrop-blur-sm hover:bg-muted/30 border border-border rounded-xl transition-colors"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                {/* Workspace Logo or Initial */}
                <div
                    className="flex items-center justify-center w-6 h-6 rounded text-foreground text-xs font-bold"
                    style={{ backgroundColor: workspace.primaryColor }}
                >
                    {workspace.logo ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={workspace.logo}
                                alt={workspace.name}
                                className="w-full h-full object-cover rounded"
                            />
                        </>
                    ) : (
                        workspace.name.charAt(0).toUpperCase()
                    )}
                </div>

                {/* Workspace Name */}
                <span className="max-w-[150px] truncate">{workspace.name}</span>

                {/* Chevron */}
                <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
            </button>

            {isOpen && (
                <div
                    className="absolute left-0 mt-2 w-64 origin-top-left bg-card backdrop-blur-sm border border-border rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-in fade-in zoom-in-95 duration-100"
                    role="menu"
                >
                    <div className="px-3 py-2 border-b border-border">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Workspaces
                        </p>
                    </div>

                    <div className="py-1 max-h-64 overflow-y-auto">
                        {workspaces?.map((ws) => (
                            <button type="button"
                                key={ws.id}
                                onClick={() => { switchWorkspace(ws.id); setIsOpen(false); }}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors
                                    hover:bg-muted/50
                                    ${ws.id === workspace.id ? 'text-primary' : 'text-foreground'}
                                `}
                                role="menuitem"
                            >
                                {/* Workspace Logo/Initial */}
                                <div
                                    className="flex items-center justify-center w-8 h-8 rounded text-foreground text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: ws.primaryColor }}
                                >
                                    {ws.logo ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={ws.logo}
                                                alt={ws.name}
                                                className="w-full h-full object-cover rounded"
                                            />
                                        </>
                                    ) : (
                                        ws.name.charAt(0).toUpperCase()
                                    )}
                                </div>

                                {/* Workspace Info */}
                                <div className="flex-1 text-left min-w-0">
                                    <p className="font-medium truncate">{ws.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {ws.subscription.plan} • {ws._count.assets} assets
                                    </p>
                                </div>

                                {/* Active Indicator */}
                                {ws.id === workspace.id && (
                                    <CheckIcon className="w-5 h-5 flex-shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Create New Workspace */}
                    <div className="border-t border-border py-1">
                        <button type="button"
                            onClick={() => { setIsOpen(false); router.push('/workspaces/new'); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 text-primary transition-colors"
                            role="menuitem"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Create New Workspace
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
