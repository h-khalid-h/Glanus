
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Workspace {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    plan?: string;
}

interface WorkspaceState {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    isLoading: boolean;
    error: string | null;
    /** Only this field is persisted — the full object is always fetched from the server */
    _savedWorkspaceId: string | null;

    // Actions
    setWorkspaces: (workspaces: Workspace[]) => void;
    setCurrentWorkspace: (workspace: Workspace | null) => void;
    setCurrentWorkspaceById: (id: string) => void;
    fetchWorkspaces: () => Promise<void>;
    reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set, get) => ({
            workspaces: [],
            currentWorkspace: null,
            isLoading: false,
            error: null,
            _savedWorkspaceId: null,

            setWorkspaces: (workspaces) => set({ workspaces }),

            setCurrentWorkspace: (workspace) =>
                set({ currentWorkspace: workspace, _savedWorkspaceId: workspace?.id ?? null }),

            setCurrentWorkspaceById: (id) => {
                const { workspaces } = get();
                const workspace = workspaces.find((w) => w.id === id) || null;
                set({ currentWorkspace: workspace, _savedWorkspaceId: workspace?.id ?? null });
            },

            fetchWorkspaces: async () => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch('/api/workspaces');
                    if (!response.ok) throw new Error('Failed to fetch workspaces');

                    const result = await response.json();
                    const fetchedWorkspaces: Workspace[] = result.data?.workspaces || [];
                    set({ workspaces: fetchedWorkspaces, isLoading: false });

                    // Restore the previously selected workspace by ID, or fall back to first
                    const { _savedWorkspaceId } = get();
                    const toSelect =
                        (fetchedWorkspaces.find((w) => w.id === _savedWorkspaceId) ??
                            fetchedWorkspaces[0]) ||
                        null;
                    set({ currentWorkspace: toSelect, _savedWorkspaceId: toSelect?.id ?? null });
                } catch (error: unknown) {
                    set({
                        error: error instanceof Error ? error.message : 'Unknown error',
                        isLoading: false,
                    });
                }
            },

            reset: () =>
                set({ workspaces: [], currentWorkspace: null, error: null, _savedWorkspaceId: null }),
        }),
        {
            name: 'glanus-workspace-storage',
            // Only persist the selected workspace ID — never full workspace data.
            // Subscription details, member info, and plan limits must always come
            // from the server to prevent XSS exfiltration and client-side tampering.
            partialize: (state) => ({ _savedWorkspaceId: state._savedWorkspaceId }),
        }
    )
);
