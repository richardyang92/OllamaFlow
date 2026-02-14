import { create } from 'zustand'
import type { WorkspaceConfig, RecentWorkspace } from '@/types/workspace'

interface WorkspaceState {
  currentWorkspace: {
    path: string
    config: WorkspaceConfig
  } | null
  recentWorkspaces: RecentWorkspace[]
  isLoading: boolean
  error: string | null

  // Actions
  setCurrentWorkspace: (path: string, config: WorkspaceConfig) => void
  clearCurrentWorkspace: () => void
  updateConfig: (config: Partial<WorkspaceConfig>) => void
  setRecentWorkspaces: (workspaces: RecentWorkspace[]) => void
  addRecentWorkspace: (workspace: RecentWorkspace) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentWorkspace: null,
  recentWorkspaces: [],
  isLoading: false,
  error: null,

  setCurrentWorkspace: (path, config) => {
    set({
      currentWorkspace: { path, config },
      error: null,
    })
    // Add to recent workspaces
    window.electronAPI.recent.add(path, config.name)
  },

  clearCurrentWorkspace: () => {
    set({
      currentWorkspace: null,
      error: null,
    })
  },

  updateConfig: (config) => {
    const { currentWorkspace } = get()
    if (currentWorkspace) {
      set({
        currentWorkspace: {
          ...currentWorkspace,
          config: { ...currentWorkspace.config, ...config },
        },
      })
    }
  },

  setRecentWorkspaces: (workspaces) => {
    set({ recentWorkspaces: workspaces })
  },

  addRecentWorkspace: (workspace) => {
    const { recentWorkspaces } = get()
    const filtered = recentWorkspaces.filter((w) => w.path !== workspace.path)
    set({
      recentWorkspaces: [workspace, ...filtered].slice(0, 10),
    })
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}))
