import { create } from 'zustand'
import type { WorkspaceConfig, RecentWorkspace } from '@/types/workspace'
import { useExecutionStore } from './execution-store'

const DEBUG = true
const log = (...args: unknown[]) => DEBUG && console.log('[WorkspaceStore]', ...args)

type AppPage = 'welcome' | 'wizard' | 'editor' | 'agent'

interface WorkspaceState {
  currentWorkspace: {
    path: string
    config: WorkspaceConfig
  } | null
  recentWorkspaces: RecentWorkspace[]
  isLoading: boolean
  error: string | null
  currentPage: AppPage
  // 导航状态：是否显示侧边导航栏
  showNavigation: boolean

  // Actions
  setCurrentWorkspace: (path: string, config: WorkspaceConfig) => void
  clearCurrentWorkspace: () => void
  updateConfig: (config: Partial<WorkspaceConfig>) => void
  setRecentWorkspaces: (workspaces: RecentWorkspace[]) => void
  addRecentWorkspace: (workspace: RecentWorkspace) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setCurrentPage: (page: AppPage) => void
  setShowNavigation: (show: boolean) => void
  // 便捷导航方法
  goToAgent: () => void
  goToEditor: () => void
  goToWelcome: () => void
  goToWizard: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentWorkspace: null,
  recentWorkspaces: [],
  isLoading: false,
  error: null,
  currentPage: 'agent',
  showNavigation: true,

  setCurrentWorkspace: (path, config) => {
    log('setCurrentWorkspace', { path, name: config.name })
    set({
      currentWorkspace: { path, config },
      error: null,
    })
    log('setCurrentWorkspace - calling switchWorkspaceContext')
    useExecutionStore.getState().switchWorkspaceContext(path)
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

  setCurrentPage: (page) => set({ currentPage: page }),

  setShowNavigation: (show) => set({ showNavigation: show }),

  goToAgent: () => set({ currentPage: 'agent' }),

  goToEditor: () => set({ currentPage: 'editor' }),

  goToWelcome: () => set({ currentPage: 'welcome' }),

  goToWizard: () => set({ currentPage: 'wizard' }),
}))
