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
    userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
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
    const { data: session, status } = useSession();
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all workspaces for the current user
    const fetchWorkspaces = useCallback(async () => {
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

            // Auto-select workspace from localStorage or first workspace
            const storedWorkspaceId = localStorage.getItem('currentWorkspaceId');
            if (storedWorkspaceId) {
                const stored = fetchedWorkspaces.find((w: Workspace) => w.id === storedWorkspaceId);
                if (stored) {
                    setWorkspace(stored);
                } else if (fetchedWorkspaces.length > 0) {
                    setWorkspace(fetchedWorkspaces[0]);
                    localStorage.setItem('currentWorkspaceId', fetchedWorkspaces[0].id);
                }
            } else if (fetchedWorkspaces.length > 0) {
                setWorkspace(fetchedWorkspaces[0]);
                localStorage.setItem('currentWorkspaceId', fetchedWorkspaces[0].id);
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

// Utility function to check if user has permission in current workspace
export function useWorkspacePermission(requiredRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
    const { workspace } = useWorkspace();

    if (!workspace) return false;

    const roleHierarchy = {
        OWNER: 4,
        ADMIN: 3,
        MEMBER: 2,
        VIEWER: 1,
    };

    return roleHierarchy[workspace.userRole] >= roleHierarchy[requiredRole];
}
