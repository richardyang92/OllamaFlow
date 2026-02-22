import { contextBridge, ipcRenderer } from 'electron'

// Types
export interface WorkspaceConfig {
  name: string
  description?: string
  ollamaHost: string
  defaultModel: string
  created: string
  lastOpened: string
}

export interface WorkflowData {
  metadata: {
    id: string
    name: string
    createdAt: string
    updatedAt: string
    version: string
  }
  nodes: unknown[]
  edges: unknown[]
  viewport?: { x: number; y: number; zoom: number }
}

export interface FileInfo {
  name: string
  isDirectory: boolean
  path: string
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
  success: boolean
}

export interface CommandOptions {
  command: string
  cwd?: string
  timeout?: number
  env?: Record<string, string>
}

export interface RecentWorkspace {
  path: string
  name: string
  lastOpened: string
}

export interface HttpFetchOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
}

export interface HttpFetchResult {
  success: boolean
  status: number
  statusText: string
  body: string
  error?: string
}

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Workspace operations
  workspace: {
    open: (): Promise<string | null> => ipcRenderer.invoke('workspace:open'),

    init: (path: string, config: { name: string }): Promise<{ config: WorkspaceConfig; workflow: WorkflowData }> =>
      ipcRenderer.invoke('workspace:init', path, config),

    readConfig: (path: string): Promise<WorkspaceConfig | null> =>
      ipcRenderer.invoke('workspace:readConfig', path),

    updateConfig: (path: string, config: Partial<WorkspaceConfig>): Promise<WorkspaceConfig> =>
      ipcRenderer.invoke('workspace:updateConfig', path, config),

    readWorkflow: (path: string): Promise<WorkflowData | null> =>
      ipcRenderer.invoke('workspace:readWorkflow', path),

    saveWorkflow: (path: string, workflow: WorkflowData): Promise<boolean> =>
      ipcRenderer.invoke('workspace:saveWorkflow', path, workflow),
  },

  // File operations
  file: {
    read: (workspacePath: string, relativePath: string): Promise<{ success: boolean; content?: string; error?: string }> =>
      ipcRenderer.invoke('file:read', workspacePath, relativePath),

    write: (workspacePath: string, relativePath: string, content: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('file:write', workspacePath, relativePath, content),

    list: (workspacePath: string, relativePath?: string): Promise<{ success: boolean; files?: FileInfo[]; error?: string }> =>
      ipcRenderer.invoke('file:list', workspacePath, relativePath),

    exists: (workspacePath: string, relativePath: string): Promise<boolean> =>
      ipcRenderer.invoke('file:exists', workspacePath, relativePath),

    readImage: (workspacePath: string, relativePath: string): Promise<{ success: boolean; dataUrl?: string; error?: string }> =>
      ipcRenderer.invoke('file:readImage', workspacePath, relativePath),
  },

  // Command execution
  command: {
    execute: (workspacePath: string, options: CommandOptions): Promise<CommandResult> =>
      ipcRenderer.invoke('command:execute', workspacePath, options),
  },

  // Recent workspaces
  recent: {
    get: (): Promise<RecentWorkspace[]> => ipcRenderer.invoke('recent:get'),

    add: (path: string, name: string): Promise<RecentWorkspace[]> =>
      ipcRenderer.invoke('recent:add', path, name),

    remove: (path: string): Promise<RecentWorkspace[]> =>
      ipcRenderer.invoke('recent:remove', path),
  },

  // HTTP fetch
  http: {
    fetch: (options: HttpFetchOptions): Promise<HttpFetchResult> =>
      ipcRenderer.invoke('http:fetch', options),
  },
})

// Type declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      workspace: {
        open: () => Promise<string | null>
        init: (path: string, config: { name: string }) => Promise<{ config: WorkspaceConfig; workflow: WorkflowData }>
        readConfig: (path: string) => Promise<WorkspaceConfig | null>
        updateConfig: (path: string, config: Partial<WorkspaceConfig>) => Promise<WorkspaceConfig>
        readWorkflow: (path: string) => Promise<WorkflowData | null>
        saveWorkflow: (path: string, workflow: WorkflowData) => Promise<boolean>
      }
      file: {
        read: (workspacePath: string, relativePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
        write: (workspacePath: string, relativePath: string, content: string) => Promise<{ success: boolean; error?: string }>
        list: (workspacePath: string, relativePath?: string) => Promise<{ success: boolean; files?: FileInfo[]; error?: string }>
        exists: (workspacePath: string, relativePath: string) => Promise<boolean>
        readImage: (workspacePath: string, relativePath: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>
      }
      command: {
        execute: (workspacePath: string, options: CommandOptions) => Promise<CommandResult>
      }
      recent: {
        get: () => Promise<RecentWorkspace[]>
        add: (path: string, name: string) => Promise<RecentWorkspace[]>
        remove: (path: string) => Promise<RecentWorkspace[]>
      }
      http: {
        fetch: (options: HttpFetchOptions) => Promise<HttpFetchResult>
      }
    }
  }
}
