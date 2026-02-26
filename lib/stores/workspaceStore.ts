
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

            setWorkspaces: (workspaces) => set({ workspaces }),

            setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),

            setCurrentWorkspaceById: (id) => {
                const { workspaces } = get();
                const workspace = workspaces.find((w) => w.id === id) || null;
                set({ currentWorkspace: workspace });
            },

            fetchWorkspaces: async () => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch('/api/workspaces');
                    if (!response.ok) throw new Error('Failed to fetch workspaces');

                    const result = await response.json();

                    // The API returns { success: true, data: { workspaces: [...] } }
                    const fetchedWorkspaces = result.data?.workspaces || [];

                    set({ workspaces: fetchedWorkspaces, isLoading: false });

                    // If no current workspace is selected, select the first one
                    const { currentWorkspace, workspaces } = get();
                    if (!currentWorkspace && workspaces.length > 0) {
                        set({ currentWorkspace: workspaces[0] });
                    }
                } catch (error: unknown) {
                    set({
                        error: error instanceof Error ? error.message : 'Unknown error',
                        isLoading: false
                    });
                }
            },

            reset: () => set({ workspaces: [], currentWorkspace: null, error: null }),
        }),
        {
            name: 'glanus-workspace-storage',
            partialize: (state) => ({
                currentWorkspace: state.currentWorkspace,
                // We generally don't persist the full list as it might go stale
                // But persisting currentWorkspace helps with page reloads
            }),
        }
    )
);
