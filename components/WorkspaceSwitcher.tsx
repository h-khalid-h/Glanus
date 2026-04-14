'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useWorkspaceStore, Workspace } from '@/lib/stores/workspaceStore';
import { useWorkspace } from '@/lib/workspace/context';
import { ChevronsUpDown, Check, Plus, Building } from 'lucide-react';

export default function WorkspaceSwitcher() {
    const router = useRouter();
    const _pathname = usePathname();
    const { workspaces, currentWorkspace, setCurrentWorkspace, fetchWorkspaces, isLoading } = useWorkspaceStore();
    const { switchWorkspace } = useWorkspace();
    const [mounted, setMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
        fetchWorkspaces();
    }, [fetchWorkspaces]);

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

    const handleSelect = async (workspace: Workspace) => {
        setCurrentWorkspace(workspace);
        await switchWorkspace(workspace.id);
        setIsOpen(false);
        router.refresh();
    };

    if (!mounted || isLoading) {
        return (
            <div className="w-64 h-10 bg-muted rounded-xl animate-pulse" />
        );
    }

    return (
        <div className="relative inline-block text-left w-full max-w-xs" ref={menuRef}>
            <button type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex w-full items-center justify-between rounded-xl border border-border bg-card backdrop-blur-sm px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 transition-colors"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <div className="flex items-center gap-2 truncate">
                    <div
                        className="w-5 h-5 rounded bg-primary/15 flex items-center justify-center text-primary shrink-0"
                        style={{ backgroundColor: currentWorkspace?.primaryColor ? `${currentWorkspace.primaryColor}20` : undefined, color: currentWorkspace?.primaryColor || undefined }}
                    >
                        {currentWorkspace?.logo ? (
                            <Image src={currentWorkspace.logo} alt="" width={20} height={20} className="w-full h-full rounded object-cover" />
                        ) : (
                            <Building className="w-3 h-3" />
                        )}
                    </div>
                    <span className="truncate">{currentWorkspace?.name || 'Select Workspace'}</span>
                </div>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>

            {isOpen && (
                <div
                    className="absolute left-0 mt-2 w-full min-w-[240px] origin-top-left divide-y divide-border rounded-xl bg-card backdrop-blur-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 p-1 animate-in fade-in zoom-in-95 duration-100"
                    role="menu"
                >
                    <div className="px-1 py-1 max-h-60 overflow-y-auto custom-scrollbar">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            My Workspaces
                        </div>
                        {workspaces.map((workspace) => (
                            <button type="button"
                                key={workspace.id}
                                onClick={() => handleSelect(workspace)}
                                className="group flex w-full items-center justify-between rounded-md px-2 py-2 text-sm transition-colors hover:bg-primary/10 hover:text-primary text-foreground"
                                role="menuitem"
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <div
                                        className="w-5 h-5 rounded bg-muted flex items-center justify-center text-muted-foreground shrink-0"
                                        style={{
                                            backgroundColor: workspace.primaryColor ? `${workspace.primaryColor}20` : undefined,
                                            color: workspace.primaryColor || undefined
                                        }}
                                    >
                                        <Building className="w-3 h-3" />
                                    </div>
                                    <span className="truncate">{workspace.name}</span>
                                </div>
                                {currentWorkspace?.id === workspace.id && (
                                    <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="px-1 py-1 mt-1 border-t border-border">
                        <button type="button"
                            onClick={() => { setIsOpen(false); router.push('/workspaces/new'); }}
                            className="group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                            role="menuitem"
                        >
                            <div className="w-5 h-5 rounded border border-dashed border-border flex items-center justify-center">
                                <Plus className="w-3 h-3" />
                            </div>
                            Create Workspace
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
