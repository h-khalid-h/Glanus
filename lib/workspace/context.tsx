'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Workspace {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo?: string;
    primaryColor: string;
    accentColor: string;
    userRole: 'OWNER' | 'ADMIN' | 'STAFF' | 'MEMBER' | 'VIEWER';
    subscription: {
        plan: string;
        status: string;
        maxAssets: number;
        aiCreditsUsed: number;
        maxAICreditsPerMonth: number;
    };
    _count: {
        assets: number;
        members: number;
    };
}

interface WorkspaceContextType {
    workspace: Workspace | null;
    workspaces: Workspace[];
    isLoading: boolean;
    error: string | null;
    switchWorkspace: (id: string) => Promise<void>;
    refetchWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
    const { status } = useSession();
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all workspaces for the current user
    const fetchWorkspaces = useCallback(async () => {
        // Maintain loading state while NextAuth initializes
        if (status === 'loading') return;

        if (status !== 'authenticated') {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch('/api/workspaces');
            if (!response.ok) {
                throw new Error('Failed to fetch workspaces');
            }

            const result = await response.json();
            const fetchedWorkspaces = result.data?.workspaces || [];
            setWorkspaces(fetchedWorkspaces);

            // During impersonation, prefer the workspace from the impersonation cookie
            // over localStorage (which may still hold the admin's previous workspace).
            let preferredWorkspaceId: string | null = null;
            try {
                const impCookie = document.cookie
                    .split('; ')
                    .find((c) => c.startsWith('glanus-impersonation='));
                if (impCookie) {
                    const meta = JSON.parse(decodeURIComponent(impCookie.split('=').slice(1).join('=')));
                    if (meta?.workspaceId) {
                        preferredWorkspaceId = meta.workspaceId;
                    }
                }
            } catch {
                // Ignore parse errors — fall through to normal selection
            }

            const targetId = preferredWorkspaceId || localStorage.getItem('currentWorkspaceId');

            // Auto-select workspace from impersonation cookie, localStorage, or first workspace
            let selectedId: string | null = null;
            if (targetId) {
                const target = fetchedWorkspaces.find((w: Workspace) => w.id === targetId);
                if (target) {
                    setWorkspace(target);
                    localStorage.setItem('currentWorkspaceId', target.id);
                    selectedId = target.id;
                } else if (fetchedWorkspaces.length > 0) {
                    setWorkspace(fetchedWorkspaces[0]);
                    localStorage.setItem('currentWorkspaceId', fetchedWorkspaces[0].id);
                    selectedId = fetchedWorkspaces[0].id;
                }
            } else if (fetchedWorkspaces.length > 0) {
                setWorkspace(fetchedWorkspaces[0]);
                localStorage.setItem('currentWorkspaceId', fetchedWorkspaces[0].id);
                selectedId = fetchedWorkspaces[0].id;
            }

            // Embed workspace claim (wid + wRole) into the JWT so that
            // middleware RBAC guards can check the role without a DB lookup.
            if (selectedId) {
                try {
                    await fetch('/api/auth/switch-workspace', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ workspaceId: selectedId }),
                        credentials: 'include',
                    });
                } catch {
                    // Non-fatal — falls back to DB lookup on API routes
                }
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load workspaces');
        } finally {
            setIsLoading(false);
        }
    }, [status]);

    // Switch to a different workspace
    const switchWorkspace = useCallback(async (id: string) => {
        const targetWorkspace = workspaces.find((w) => w.id === id);
        if (targetWorkspace) {
            setWorkspace(targetWorkspace);
            localStorage.setItem('currentWorkspaceId', id);
        }

        // Embed the workspace claim into the JWT so that subsequent API
        // requests to /api/workspaces/[id]/** can skip the DB membership
        // lookup via the requireWorkspaceAccess() claim fast-path.
        try {
            await fetch('/api/auth/switch-workspace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: id }),
                credentials: 'include',
            });
        } catch {
            // Non-fatal: the app works without the claim, just falls back to DB.
        }
    }, [workspaces]);

    // Fetch workspaces on mount and when session changes
    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    const value: WorkspaceContextType = {
        workspace,
        workspaces,
        isLoading,
        error,
        switchWorkspace,
        refetchWorkspaces: fetchWorkspaces,
    };

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}

// Convenience hook — returns the currently selected workspace's ID from context.
// Use this in all routes instead of reading from URL params.
export function useWorkspaceId(): string {
    const { workspace } = useWorkspace();
    return workspace?.id ?? '';
}

// Utility function to check if user has permission in current workspace
export function useWorkspacePermission(requiredRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
    const { workspace } = useWorkspace();

    if (!workspace) return false;

    const roleHierarchy: Record<string, number> = {
        OWNER: 5,
        ADMIN: 4,
        STAFF: 3,
        MEMBER: 2,
        VIEWER: 1,
    };

    return (roleHierarchy[workspace.userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}
