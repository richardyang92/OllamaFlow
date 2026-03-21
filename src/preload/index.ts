import { contextBridge, ipcRenderer } from 'electron'

// Types
export interface WorkspaceConfig {
  name: string
  description?: string
  apiEndpoint: string  // OpenAI-compatible endpoint, e.g., "http://localhost:11434/v1" or "https://api.openai.com/v1"
  defaultModel: string
  created: string
  lastOpened: string
}

export interface WorkspaceInitOptions {
  name: string
  description?: string
  apiEndpoint?: string
  defaultModel?: string
  initialWorkflow?: WorkflowData
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
  mtime?: number    // 修改时间戳（毫秒）
  size?: number     // 文件大小（字节）
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
  description?: string
  lastOpened: string
}

export interface WorkspaceExecutionStatus {
  workspacePath: string
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  startTime?: string
  endTime?: string
  progress: number
  totalNodes: number
  completedNodes: number
  currentNode?: string
  error?: string
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

// Browser types
export interface BrowserInitOptions {
  headless?: boolean
  viewport?: { width: number; height: number }
  timeout?: number
}

export interface BrowserSession {
  id: string
  createdAt: string
  options: BrowserInitOptions
}

export interface BrowserStatus {
  isConnected: boolean
  currentPageUrl: string | null
  pageTitle: string | null
  tabs: TabInfo[]
}

export interface NavigateResult {
  success: boolean
  url: string
  title: string
  error?: string
}

export interface ClickOptions {
  button?: 'left' | 'right' | 'middle'
  clickCount?: number
  delay?: number
  timeout?: number
}

export interface TypeOptions {
  delay?: number
  clear?: boolean
}

export interface ActionResult {
  success: boolean
  message: string
  error?: string
}

export interface ScreenshotOptions {
  fullPage?: boolean
  selector?: string
  format?: 'png' | 'jpeg'
}

export interface ScreenshotResult {
  success: boolean
  dataUrl: string
  width: number
  height: number
  error?: string
}

export interface GetContentOptions {
  selector?: string
  format: 'text' | 'html'
  trim?: boolean
  maxLength?: number
}

export interface ContentResult {
  success: boolean
  content: string
  format: 'text' | 'html'
  length: number
  truncated?: boolean
  error?: string
}

export interface EvaluateResult {
  success: boolean
  result: unknown
  error?: string
}

export interface WaitOptions {
  timeout?: number
  state?: 'visible' | 'hidden' | 'attached' | 'detached'
}

export interface TabInfo {
  id: string
  url: string
  title: string
  isActive: boolean
}

export interface ScrollOptions {
  direction: 'up' | 'down' | 'left' | 'right'
  amount?: number
}

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Workspace operations
  workspace: {
    open: (): Promise<string | null> => ipcRenderer.invoke('workspace:open'),

    getDefaultProjectsPath: (): Promise<string> => ipcRenderer.invoke('workspace:getDefaultProjectsPath'),

    getCustomProjectsPath: (): Promise<string | null> => ipcRenderer.invoke('workspace:getCustomProjectsPath'),

    setCustomProjectsPath: (customPath: string | null): Promise<boolean> =>
      ipcRenderer.invoke('workspace:setCustomProjectsPath', customPath),

    selectCustomProjectsPath: (): Promise<string | null> => ipcRenderer.invoke('workspace:selectCustomProjectsPath'),

    init: (path: string, options: WorkspaceInitOptions): Promise<{ config: WorkspaceConfig; workflow: WorkflowData }> =>
      ipcRenderer.invoke('workspace:init', path, options),

    readConfig: (path: string): Promise<WorkspaceConfig | null> =>
      ipcRenderer.invoke('workspace:readConfig', path),

    updateConfig: (path: string, config: Partial<WorkspaceConfig>): Promise<WorkspaceConfig> =>
      ipcRenderer.invoke('workspace:updateConfig', path, config),

    readWorkflow: (path: string): Promise<WorkflowData | null> =>
      ipcRenderer.invoke('workspace:readWorkflow', path),

    saveWorkflow: (path: string, workflow: WorkflowData): Promise<boolean> =>
      ipcRenderer.invoke('workspace:saveWorkflow', path, workflow),

    delete: (path: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('workspace:delete', path),

    rename: (path: string, newName: string): Promise<{ success: boolean; newPath?: string; config?: WorkspaceConfig; error?: string }> =>
      ipcRenderer.invoke('workspace:rename', path, newName),

    exists: (absolutePath: string): Promise<boolean> =>
      ipcRenderer.invoke('workspace:exists', absolutePath),
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

    readPdf: (workspacePath: string, relativePath: string): Promise<{ success: boolean; dataUrl?: string; error?: string }> =>
      ipcRenderer.invoke('file:readPdf', workspacePath, relativePath),

    copy: (sourcePath: string, destPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('file:copy', sourcePath, destPath),

    copyFiles: (files: Array<{ sourcePath: string; destPath: string }>): Promise<{ 
      success: boolean; 
      results?: Array<{ sourcePath: string; destPath: string; success: boolean; error?: string }>;
      error?: string 
    }> => ipcRenderer.invoke('file:copyFiles', files),
  },

  // Command execution
  command: {
    execute: (workspacePath: string, options: CommandOptions): Promise<CommandResult> =>
      ipcRenderer.invoke('command:execute', workspacePath, options),
  },

  // Recent workspaces
  recent: {
    get: (): Promise<RecentWorkspace[]> => ipcRenderer.invoke('recent:get'),

    add: (path: string, name: string, description?: string): Promise<RecentWorkspace[]> =>
      ipcRenderer.invoke('recent:add', path, name, description),

    remove: (path: string): Promise<RecentWorkspace[]> =>
      ipcRenderer.invoke('recent:remove', path),
  },

  // Workflow import/export
  workflow: {
    export: (workflowData: string): Promise<string | null> =>
      ipcRenderer.invoke('workflow:export', workflowData),

    import: (): Promise<string | null> =>
      ipcRenderer.invoke('workflow:import'),

    discoverAll: (): Promise<Array<{ id: string; workspacePath: string; name: string; description?: string }>> =>
      ipcRenderer.invoke('workflow:discoverAll'),

    loadData: (workspacePath: string): Promise<WorkflowData | null> =>
      ipcRenderer.invoke('workflow:loadData', workspacePath),
  },

  // Execution status
  execution: {
    getAllStatuses: (): Promise<Record<string, WorkspaceExecutionStatus>> =>
      ipcRenderer.invoke('execution:getAllStatuses'),

    getStatus: (workspacePath: string): Promise<WorkspaceExecutionStatus | null> =>
      ipcRenderer.invoke('execution:getStatus', workspacePath),

    updateStatus: (status: WorkspaceExecutionStatus): Promise<WorkspaceExecutionStatus> =>
      ipcRenderer.invoke('execution:updateStatus', status),

    clearStatus: (workspacePath: string): Promise<boolean> =>
      ipcRenderer.invoke('execution:clearStatus', workspacePath),

    start: (workspacePath: string): Promise<WorkspaceExecutionStatus> =>
      ipcRenderer.invoke('execution:start', workspacePath),

    pause: (workspacePath: string): Promise<WorkspaceExecutionStatus | null> =>
      ipcRenderer.invoke('execution:pause', workspacePath),

    resume: (workspacePath: string): Promise<WorkspaceExecutionStatus | null> =>
      ipcRenderer.invoke('execution:resume', workspacePath),

    cancel: (workspacePath: string): Promise<WorkspaceExecutionStatus | null> =>
      ipcRenderer.invoke('execution:cancel', workspacePath),
  },

  // HTTP fetch
  http: {
    fetch: (options: HttpFetchOptions): Promise<HttpFetchResult> =>
      ipcRenderer.invoke('http:fetch', options),
  },

  // Browser automation
  browser: {
    init: (workspacePath: string, options?: BrowserInitOptions): Promise<BrowserSession> =>
      ipcRenderer.invoke('browser:init', workspacePath, options),

    close: (workspacePath: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('browser:close', workspacePath),

    getStatus: (workspacePath: string): Promise<BrowserStatus> =>
      ipcRenderer.invoke('browser:getStatus', workspacePath),

    navigate: (workspacePath: string, url: string): Promise<NavigateResult> =>
      ipcRenderer.invoke('browser:navigate', workspacePath, url),

    click: (workspacePath: string, selector: string, options?: ClickOptions): Promise<ActionResult> =>
      ipcRenderer.invoke('browser:click', workspacePath, selector, options),

    type: (workspacePath: string, selector: string, text: string, options?: TypeOptions): Promise<ActionResult> =>
      ipcRenderer.invoke('browser:type', workspacePath, selector, text, options),

    scroll: (workspacePath: string, options: ScrollOptions): Promise<ActionResult> =>
      ipcRenderer.invoke('browser:scroll', workspacePath, options),

    screenshot: (workspacePath: string, options?: ScreenshotOptions): Promise<ScreenshotResult> =>
      ipcRenderer.invoke('browser:screenshot', workspacePath, options),

    getContent: (workspacePath: string, options: GetContentOptions): Promise<ContentResult> =>
      ipcRenderer.invoke('browser:getContent', workspacePath, options),

    evaluate: (workspacePath: string, script: string): Promise<EvaluateResult> =>
      ipcRenderer.invoke('browser:evaluate', workspacePath, script),

    waitForSelector: (workspacePath: string, selector: string, options?: WaitOptions): Promise<ActionResult> =>
      ipcRenderer.invoke('browser:waitForSelector', workspacePath, selector, options),

    waitForTimeout: (workspacePath: string, ms: number): Promise<void> =>
      ipcRenderer.invoke('browser:waitForTimeout', workspacePath, ms),

    getTabs: (workspacePath: string): Promise<TabInfo[]> =>
      ipcRenderer.invoke('browser:getTabs', workspacePath),

    switchTab: (workspacePath: string, tabId: string): Promise<ActionResult> =>
      ipcRenderer.invoke('browser:switchTab', workspacePath, tabId),

    newTab: (workspacePath: string, url?: string): Promise<TabInfo> =>
      ipcRenderer.invoke('browser:newTab', workspacePath, url),

    closeTab: (workspacePath: string, tabId: string): Promise<ActionResult> =>
      ipcRenderer.invoke('browser:closeTab', workspacePath, tabId),

    goBack: (workspacePath: string): Promise<ActionResult> =>
      ipcRenderer.invoke('browser:goBack', workspacePath),

    goForward: (workspacePath: string): Promise<ActionResult> =>
      ipcRenderer.invoke('browser:goForward', workspacePath),
  },

  // OpenAI API Key storage
  openai: {
    getApiKey: (keyId: string): Promise<string | null> =>
      ipcRenderer.invoke('openai:getApiKey', keyId),

    setApiKey: (keyId: string, apiKey: string): Promise<boolean> =>
      ipcRenderer.invoke('openai:setApiKey', keyId, apiKey),

    deleteApiKey: (keyId: string): Promise<boolean> =>
      ipcRenderer.invoke('openai:deleteApiKey', keyId),
  },

  // Global AI Config
  globalAI: {
    getConfig: (): Promise<{
      enabled: boolean
      apiEndpoint: string
      defaultModel?: string
      provider: 'ollama' | 'openai' | 'deepseek' | 'vllm' | 'custom'
      name?: string
    } | null> => ipcRenderer.invoke('globalAI:getConfig'),

    setConfig: (config: {
      enabled: boolean
      apiEndpoint: string
      defaultModel?: string
      provider: 'ollama' | 'openai' | 'deepseek' | 'vllm' | 'custom'
      name?: string
    }): Promise<boolean> => ipcRenderer.invoke('globalAI:setConfig', config),

    getApiKey: (): Promise<string | null> =>
      ipcRenderer.invoke('globalAI:getApiKey'),

    setApiKey: (apiKey: string): Promise<boolean> =>
      ipcRenderer.invoke('globalAI:setApiKey', apiKey),

    deleteApiKey: (): Promise<boolean> =>
      ipcRenderer.invoke('globalAI:deleteApiKey'),

    clearConfig: (): Promise<boolean> =>
      ipcRenderer.invoke('globalAI:clearConfig'),

    testConnection: (config: { apiEndpoint: string; apiKey?: string }): Promise<{
      success: boolean
      models?: Array<{ id: string; name?: string; owned_by?: string }>
      error?: string
    }> => ipcRenderer.invoke('globalAI:testConnection', config),
  },

  // Platform info (synchronous, no IPC needed)
  platform: {
    getOS: () => process.platform,  // 'darwin' | 'win32' | 'linux'
    isMac: () => process.platform === 'darwin',
    isWindows: () => process.platform === 'win32',
    isLinux: () => process.platform === 'linux',
  },

  // Agent config storage
  agent: {
    getConfig: (): Promise<{
      provider: 'ollama' | 'openai'
      model: string
      apiEndpoint?: string
      apiKey?: string
    } | null> => ipcRenderer.invoke('agent:getConfig'),

    setConfig: (config: {
      provider: 'ollama' | 'openai'
      model: string
      apiEndpoint?: string
      apiKey?: string
    }): Promise<boolean> => ipcRenderer.invoke('agent:setConfig', config),

    // Conversation history
    getConversationHistory: (): Promise<{
      conversations: Array<{
        id: string
        title: string
        createdAt: number
        updatedAt: number
        messageCount: number
        preview?: string
      }>
      currentConversationId: string | null
    } | null> => ipcRenderer.invoke('agent:getConversationHistory'),

    saveConversationHistory: (history: {
      conversations: Array<{
        id: string
        title: string
        createdAt: number
        updatedAt: number
        messageCount: number
        preview?: string
      }>
      currentConversationId: string | null
    }): Promise<boolean> => ipcRenderer.invoke('agent:saveConversationHistory', history),

    getConversation: (id: string): Promise<{
      meta: {
        id: string
        title: string
        createdAt: number
        updatedAt: number
        messageCount: number
        preview?: string
      }
      messages: Array<{
        id: string
        role: 'user' | 'assistant'
        content: string
        timestamp: number
        steps?: unknown[]
        workflowCalls?: unknown[]
        isStreaming?: boolean
        responseStreaming?: boolean
      }>
    } | null> => ipcRenderer.invoke('agent:getConversation', id),

    saveConversation: (id: string, messages: Array<{
      id: string
      role: 'user' | 'assistant'
      content: string
      timestamp: number
      steps?: unknown[]
      workflowCalls?: unknown[]
      isStreaming?: boolean
      responseStreaming?: boolean
    }>): Promise<boolean> => ipcRenderer.invoke('agent:saveConversation', id, messages),

    deleteConversation: (id: string): Promise<boolean> => ipcRenderer.invoke('agent:deleteConversation', id),

    // Sandbox management
    createSandbox: (workspacePath: string, conversationId: string): Promise<{ success: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('agent:createSandbox', workspacePath, conversationId),

    deleteSandbox: (workspacePath: string, conversationId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('agent:deleteSandbox', workspacePath, conversationId),

    getSandboxPath: (workspacePath: string, conversationId: string): Promise<string> =>
      ipcRenderer.invoke('agent:getSandboxPath', workspacePath, conversationId),

    // 默认沙箱（无工作区时使用）
    createDefaultSandbox: (conversationId: string): Promise<{ success: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('agent:createDefaultSandbox', conversationId),

    getDefaultSandboxPath: (conversationId: string): Promise<string> =>
      ipcRenderer.invoke('agent:getDefaultSandboxPath', conversationId),
  },

  // File Watcher
  fileWatcher: {
    start: (workspacePath: string): Promise<{ success: boolean; message?: string; error?: string }> =>
      ipcRenderer.invoke('fileWatcher:start', workspacePath),

    stop: (workspacePath: string): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke('fileWatcher:stop', workspacePath),

    onChanged: (callback: (data: { workspacePath: string; eventType: string; filename: string }) => void) => {
      const handler = (_: unknown, data: { workspacePath: string; eventType: string; filename: string }) => callback(data)
      ipcRenderer.on('fileWatcher:changed', handler)
      return () => ipcRenderer.removeListener('fileWatcher:changed', handler)
    },
  },

  // Agent Execution Analytics
  analytics: {
    getHistory: (): Promise<Array<{
      executionId: string
      timestamp: number
      query: string
      duration: number
      iterationCount: number
      toolCallCount: number
      success: boolean
      overallScore: number
    }> | null> => ipcRenderer.invoke('analytics:getHistory'),

    saveHistory: (history: Array<{
      executionId: string
      timestamp: number
      query: string
      duration: number
      iterationCount: number
      toolCallCount: number
      success: boolean
      overallScore: number
    }>): Promise<boolean> => ipcRenderer.invoke('analytics:saveHistory', history),

    clearHistory: (): Promise<boolean> => ipcRenderer.invoke('analytics:clearHistory'),
  },

  // SimpleXNG Config
  simplexng: {
    getEndpoint: (): Promise<string> =>
      ipcRenderer.invoke('simplexng:getEndpoint'),

    setEndpoint: (endpoint: string): Promise<boolean> =>
      ipcRenderer.invoke('simplexng:setEndpoint', endpoint),
  },

  // Web Content Parser
  webParser: {
    parseHtml: (html: string, baseUrl?: string, options?: {
      maxContentLength?: number
      includeLinks?: boolean
      outputFormat?: 'markdown' | 'text'
    }): Promise<{
      title: string
      mainContent: string
      textContent: string
      links: Array<{ text: string; href: string }>
      error?: string
    }> => ipcRenderer.invoke('webParser:parseHtml', html, baseUrl, options),

    fetchAndParse: (url: string, options?: {
      maxContentLength?: number
      includeLinks?: boolean
      outputFormat?: 'markdown' | 'text'
      timeout?: number
    }): Promise<{
      title: string
      mainContent: string
      textContent: string
      links: Array<{ text: string; href: string }>
      error?: string
    }> => ipcRenderer.invoke('webParser:fetchAndParse', url, options),

    isHtml: (content: string): Promise<boolean> =>
      ipcRenderer.invoke('webParser:isHtml', content),
  },
})

// Type declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      workspace: {
        open: () => Promise<string | null>
        getDefaultProjectsPath: () => Promise<string>
        getCustomProjectsPath: () => Promise<string | null>
        setCustomProjectsPath: (customPath: string | null) => Promise<boolean>
        selectCustomProjectsPath: () => Promise<string | null>
        init: (path: string, options: WorkspaceInitOptions) => Promise<{ config: WorkspaceConfig; workflow: WorkflowData }>
        readConfig: (path: string) => Promise<WorkspaceConfig | null>
        updateConfig: (path: string, config: Partial<WorkspaceConfig>) => Promise<WorkspaceConfig>
        readWorkflow: (path: string) => Promise<WorkflowData | null>
        saveWorkflow: (path: string, workflow: WorkflowData) => Promise<boolean>
        delete: (path: string) => Promise<{ success: boolean; error?: string }>
        rename: (path: string, newName: string) => Promise<{ success: boolean; newPath?: string; config?: WorkspaceConfig; error?: string }>
        exists: (absolutePath: string) => Promise<boolean>
      }
      file: {
        read: (workspacePath: string, relativePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
        write: (workspacePath: string, relativePath: string, content: string) => Promise<{ success: boolean; error?: string }>
        list: (workspacePath: string, relativePath?: string) => Promise<{ success: boolean; files?: FileInfo[]; error?: string }>
        exists: (workspacePath: string, relativePath: string) => Promise<boolean>
        readImage: (workspacePath: string, relativePath: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>
        readPdf: (workspacePath: string, relativePath: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>
        copy: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>
        copyFiles: (files: Array<{ sourcePath: string; destPath: string }>) => Promise<{ 
          success: boolean; 
          results?: Array<{ sourcePath: string; destPath: string; success: boolean; error?: string }>;
          error?: string 
        }>
      }
      command: {
        execute: (workspacePath: string, options: CommandOptions) => Promise<CommandResult>
      }
      recent: {
        get: () => Promise<RecentWorkspace[]>
        add: (path: string, name: string, description?: string) => Promise<RecentWorkspace[]>
        remove: (path: string) => Promise<RecentWorkspace[]>
      }
      workflow: {
        export: (workflowData: string) => Promise<string | null>
        import: () => Promise<string | null>
        discoverAll: () => Promise<Array<{ id: string; workspacePath: string; name: string; description?: string }>>
        loadData: (workspacePath: string) => Promise<WorkflowData | null>
      }
      execution: {
        getAllStatuses: () => Promise<Record<string, WorkspaceExecutionStatus>>
        getStatus: (workspacePath: string) => Promise<WorkspaceExecutionStatus | null>
        updateStatus: (status: WorkspaceExecutionStatus) => Promise<WorkspaceExecutionStatus>
        clearStatus: (workspacePath: string) => Promise<boolean>
        start: (workspacePath: string) => Promise<WorkspaceExecutionStatus>
        pause: (workspacePath: string) => Promise<WorkspaceExecutionStatus | null>
        resume: (workspacePath: string) => Promise<WorkspaceExecutionStatus | null>
        cancel: (workspacePath: string) => Promise<WorkspaceExecutionStatus | null>
      }
      http: {
        fetch: (options: HttpFetchOptions) => Promise<HttpFetchResult>
      }
      browser: {
        init: (workspacePath: string, options?: BrowserInitOptions) => Promise<BrowserSession>
        close: (workspacePath: string) => Promise<{ success: boolean }>
        getStatus: (workspacePath: string) => Promise<BrowserStatus>
        navigate: (workspacePath: string, url: string) => Promise<NavigateResult>
        click: (workspacePath: string, selector: string, options?: ClickOptions) => Promise<ActionResult>
        type: (workspacePath: string, selector: string, text: string, options?: TypeOptions) => Promise<ActionResult>
        scroll: (workspacePath: string, options: ScrollOptions) => Promise<ActionResult>
        screenshot: (workspacePath: string, options?: ScreenshotOptions) => Promise<ScreenshotResult>
        getContent: (workspacePath: string, options: GetContentOptions) => Promise<ContentResult>
        evaluate: (workspacePath: string, script: string) => Promise<EvaluateResult>
        waitForSelector: (workspacePath: string, selector: string, options?: WaitOptions) => Promise<ActionResult>
        waitForTimeout: (workspacePath: string, ms: number) => Promise<void>
        getTabs: (workspacePath: string) => Promise<TabInfo[]>
        switchTab: (workspacePath: string, tabId: string) => Promise<ActionResult>
        newTab: (workspacePath: string, url?: string) => Promise<TabInfo>
        closeTab: (workspacePath: string, tabId: string) => Promise<ActionResult>
        goBack: (workspacePath: string) => Promise<ActionResult>
        goForward: (workspacePath: string) => Promise<ActionResult>
      }
      platform: {
        getOS: () => string
        isMac: () => boolean
        isWindows: () => boolean
        isLinux: () => boolean
      }
      openai: {
        getApiKey: (keyId: string) => Promise<string | null>
        setApiKey: (keyId: string, apiKey: string) => Promise<boolean>
        deleteApiKey: (keyId: string) => Promise<boolean>
      }
      globalAI: {
        getConfig: () => Promise<{
          enabled: boolean
          apiEndpoint: string
          defaultModel?: string
          provider: 'ollama' | 'openai' | 'deepseek' | 'vllm' | 'custom'
          name?: string
        } | null>
        setConfig: (config: {
          enabled: boolean
          apiEndpoint: string
          defaultModel?: string
          provider: 'ollama' | 'openai' | 'deepseek' | 'vllm' | 'custom'
          name?: string
        }) => Promise<boolean>
        getApiKey: () => Promise<string | null>
        setApiKey: (apiKey: string) => Promise<boolean>
        deleteApiKey: () => Promise<boolean>
        clearConfig: () => Promise<boolean>
        testConnection: (config: { apiEndpoint: string; apiKey?: string }) => Promise<{
          success: boolean
          models?: Array<{ id: string; name?: string; owned_by?: string }>
          error?: string
        }>
      }
      agent: {
        getConfig: () => Promise<{
          provider: 'ollama' | 'openai'
          model: string
          apiEndpoint?: string
          apiKey?: string
        } | null>
        setConfig: (config: {
          provider: 'ollama' | 'openai'
          model: string
          apiEndpoint?: string
          apiKey?: string
        }) => Promise<boolean>
        getConversationHistory: () => Promise<{
          conversations: Array<{
            id: string
            title: string
            createdAt: number
            updatedAt: number
            messageCount: number
            preview?: string
          }>
          currentConversationId: string | null
        } | null>
        saveConversationHistory: (history: {
          conversations: Array<{
            id: string
            title: string
            createdAt: number
            updatedAt: number
            messageCount: number
            preview?: string
          }>
          currentConversationId: string | null
        }) => Promise<boolean>
        getConversation: (id: string) => Promise<{
          meta: {
            id: string
            title: string
            createdAt: number
            updatedAt: number
            messageCount: number
            preview?: string
          }
          messages: unknown[]
        } | null>
        saveConversation: (id: string, messages: unknown[]) => Promise<boolean>
        deleteConversation: (id: string) => Promise<boolean>
        // Sandbox management
        createSandbox: (workspacePath: string, conversationId: string) => Promise<{ success: boolean; path?: string; error?: string }>
        deleteSandbox: (workspacePath: string, conversationId: string) => Promise<{ success: boolean; error?: string }>
        getSandboxPath: (workspacePath: string, conversationId: string) => Promise<string>
        // 默认沙箱（无工作区时使用）
        createDefaultSandbox: (conversationId: string) => Promise<{ success: boolean; path?: string; error?: string }>
        getDefaultSandboxPath: (conversationId: string) => Promise<string>
      }
      fileWatcher: {
        start: (workspacePath: string) => Promise<{ success: boolean; message?: string; error?: string }>
        stop: (workspacePath: string) => Promise<{ success: boolean; message?: string }>
        onChanged: (callback: (data: { workspacePath: string; eventType: string; filename: string }) => void) => () => void
      }
      analytics: {
        getHistory: () => Promise<Array<{
          executionId: string
          timestamp: number
          query: string
          duration: number
          iterationCount: number
          toolCallCount: number
          success: boolean
          overallScore: number
        }> | null>
        saveHistory: (history: Array<{
          executionId: string
          timestamp: number
          query: string
          duration: number
          iterationCount: number
          toolCallCount: number
          success: boolean
          overallScore: number
        }>) => Promise<boolean>
        clearHistory: () => Promise<boolean>
      }
      simplexng: {
        getEndpoint: () => Promise<string>
        setEndpoint: (endpoint: string) => Promise<boolean>
      }
      webParser: {
        parseHtml: (html: string, baseUrl?: string, options?: {
          maxContentLength?: number
          includeLinks?: boolean
          outputFormat?: 'markdown' | 'text'
        }) => Promise<{
          title: string
          mainContent: string
          textContent: string
          links: Array<{ text: string; href: string }>
          error?: string
        }>
        fetchAndParse: (url: string, options?: {
          maxContentLength?: number
          includeLinks?: boolean
          outputFormat?: 'markdown' | 'text'
          timeout?: number
        }) => Promise<{
          title: string
          mainContent: string
          textContent: string
          links: Array<{ text: string; href: string }>
          error?: string
        }>
        isHtml: (content: string) => Promise<boolean>
      }
    }
  }
}