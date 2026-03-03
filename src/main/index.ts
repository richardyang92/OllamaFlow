import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as fsWatch from 'fs'
import { spawn } from 'child_process'
import { getBrowserManager, closeBrowserManager } from './browser'

const fileWatchers = new Map<string, fsWatch.FSWatcher>()
import type {
  BrowserInitOptions,
  NavigateResult,
  ClickOptions,
  TypeOptions,
  ActionResult,
  ScreenshotOptions,
  ScreenshotResult,
  GetContentOptions,
  ContentResult,
  EvaluateResult,
  WaitOptions,
  TabInfo,
  ScrollOptions,
} from './browser/types'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.commandLine.appendSwitch('ignore-gpu-blacklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ==================== IPC Handlers ====================

// Workspace: Open folder dialog
ipcMain.handle('workspace:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Workspace Folder',
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

// Workspace: Get default projects path (cross-platform)
// Returns custom path if set, otherwise default path
// Windows: C:\Users\{user}\Documents\OllamaFlow\projects
// macOS: /Users/{user}/Documents/OllamaFlow/projects
// Linux: /home/{user}/Documents/OllamaFlow/projects (if exists) or /home/{user}/OllamaFlow/projects
ipcMain.handle('workspace:getDefaultProjectsPath', async () => {
  const s = await getStore()
  const customPath = s.get('custom-projects-path', null) as string | null

  if (customPath) {
    return customPath
  }

  const documentsPath = app.getPath('documents')
  const homePath = app.getPath('home')

  // On Linux, Documents folder may not exist, use home directory
  const basePath =
    process.platform === 'linux' && !fsSync.existsSync(documentsPath)
      ? homePath
      : documentsPath

  return path.join(basePath, 'OllamaFlow', 'projects')
})

// Workspace: Get custom projects path (returns null if not set)
ipcMain.handle('workspace:getCustomProjectsPath', async () => {
  const s = await getStore()
  return s.get('custom-projects-path', null) as string | null
})

// Workspace: Set custom projects path
ipcMain.handle('workspace:setCustomProjectsPath', async (_, customPath: string | null) => {
  const s = await getStore()
  if (customPath) {
    s.set('custom-projects-path', customPath)
  } else {
    s.delete('custom-projects-path')
  }
  return true
})

// Workspace: Open folder dialog for selecting custom projects path
ipcMain.handle('workspace:selectCustomProjectsPath', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择默认项目保存位置',
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

// Workspace: Initialize a new workspace
interface WorkspaceInitOptions {
  name: string
  description?: string
  ollamaHost?: string
  defaultModel?: string
  initialWorkflow?: {
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
}

ipcMain.handle('workspace:init', async (_, workspacePath: string, options: WorkspaceInitOptions) => {
  const ollamaflowDir = path.join(workspacePath, '.ollamaflow')
  const configPath = path.join(ollamaflowDir, 'config.json')
  const workflowPath = path.join(ollamaflowDir, 'workflow.json')

  // Create .ollamaflow directory
  await fs.mkdir(ollamaflowDir, { recursive: true })
  await fs.mkdir(path.join(ollamaflowDir, 'cache'), { recursive: true })

  // Create config.json with provided options
  const configData = {
    name: options.name,
    description: options.description || '',
    ollamaHost: options.ollamaHost || 'http://127.0.0.1:11434',
    defaultModel: options.defaultModel || 'llama3.1',
    created: new Date().toISOString(),
    lastOpened: new Date().toISOString(),
  }
  await fs.writeFile(configPath, JSON.stringify(configData, null, 2))

  // Create workflow.json - use provided workflow or create empty one
  const workflowData = options.initialWorkflow || {
    metadata: {
      id: crypto.randomUUID(),
      name: options.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
  await fs.writeFile(workflowPath, JSON.stringify(workflowData, null, 2))

  return { config: configData, workflow: workflowData }
})

// Workspace: Read config
ipcMain.handle('workspace:readConfig', async (_, workspacePath: string) => {
  const configPath = path.join(workspacePath, '.ollamaflow', 'config.json')
  try {
    const content = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
})

// Workspace: Update config
ipcMain.handle('workspace:updateConfig', async (_, workspacePath: string, config: Record<string, unknown>) => {
  const configPath = path.join(workspacePath, '.ollamaflow', 'config.json')
  const existingContent = await fs.readFile(configPath, 'utf-8')
  const existingConfig = JSON.parse(existingContent)
  const updatedConfig = { ...existingConfig, ...config, lastOpened: new Date().toISOString() }
  await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2))
  return updatedConfig
})

// Workspace: Read workflow
ipcMain.handle('workspace:readWorkflow', async (_, workspacePath: string) => {
  const workflowPath = path.join(workspacePath, '.ollamaflow', 'workflow.json')
  try {
    const content = await fs.readFile(workflowPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
})

// Workspace: Save workflow
ipcMain.handle('workspace:saveWorkflow', async (_, workspacePath: string, workflow: unknown) => {
  try {
    const workflowPath = path.join(workspacePath, '.ollamaflow', 'workflow.json')
    await fs.mkdir(path.dirname(workflowPath), { recursive: true })
    await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2))
    return true
  } catch (error) {
    console.error('保存工作流失败:', error)
    return false
  }
})

// Workspace: Delete workspace folder
ipcMain.handle('workspace:delete', async (_, workspacePath: string) => {
  try {
    await fs.rm(workspacePath, { recursive: true, force: true })
    return { success: true }
  } catch (error) {
    console.error('删除工作区失败:', error)
    return { success: false, error: (error as Error).message }
  }
})

// File: Read file
ipcMain.handle('file:read', async (_, workspacePath: string, relativePath: string) => {
  const fullPath = path.join(workspacePath, relativePath)
  try {
    const content = await fs.readFile(fullPath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// File: Write file
ipcMain.handle('file:write', async (_, workspacePath: string, relativePath: string, content: string) => {
  const fullPath = path.join(workspacePath, relativePath)
  try {
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// File: List files in directory
ipcMain.handle('file:list', async (_, workspacePath: string, relativePath: string = '') => {
  const fullPath = path.join(workspacePath, relativePath)
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    const files = entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(relativePath, entry.name),
    }))
    return { success: true, files }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// File: Check if file exists
ipcMain.handle('file:exists', async (_, workspacePath: string, relativePath: string) => {
  const fullPath = path.join(workspacePath, relativePath)
  try {
    await fs.access(fullPath)
    return true
  } catch {
    return false
  }
})

// File: Read image file as Data URL
ipcMain.handle('file:readImage', async (_, workspacePath: string, relativePath: string) => {
  const fullPath = path.join(workspacePath, relativePath)
  try {
    const buffer = await fs.readFile(fullPath)
    const base64 = buffer.toString('base64')
    
    const ext = path.extname(fullPath).toLowerCase()
    let mimeType = 'application/octet-stream'
    
    if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg'
    } else if (ext === '.png') {
      mimeType = 'image/png'
    } else if (ext === '.gif') {
      mimeType = 'image/gif'
    } else if (ext === '.webp') {
      mimeType = 'image/webp'
    } else if (ext === '.bmp') {
      mimeType = 'image/bmp'
    }
    
    return {
      success: true,
      dataUrl: `data:${mimeType};base64,${base64}`
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    }
  }
})

ipcMain.handle('file:readPdf', async (_, workspacePath: string, relativePath: string) => {
  const fullPath = path.join(workspacePath, relativePath)
  try {
    const buffer = await fs.readFile(fullPath)
    const base64 = buffer.toString('base64')
    
    return {
      success: true,
      dataUrl: `data:application/pdf;base64,${base64}`
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    }
  }
})

// Command: Execute shell command
interface CommandOptions {
  command: string
  cwd?: string
  timeout?: number
  env?: Record<string, string>
}

ipcMain.handle('command:execute', async (_, workspacePath: string, options: CommandOptions) => {
  const { command, cwd, timeout = 30000, env } = options
  const workingDir = cwd ? path.join(workspacePath, cwd) : workspacePath

  return new Promise((resolve) => {
    const proc = spawn(command, [], {
      cwd: workingDir,
      shell: true,
      env: {
        ...process.env,
        ...env,
        PYTHONIOENCODING: 'utf-8', // Ensure Python uses UTF-8 for stdout/stderr
        PYTHONUTF8: '1', // Force UTF-8 mode (Python 3.7+)
      },
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString('utf-8')
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString('utf-8')
    })

    const timer = setTimeout(() => {
      proc.kill()
      resolve({
        stdout,
        stderr,
        exitCode: -1,
        timedOut: true,
        success: false,
      })
    }, timeout)

    proc.on('close', (exitCode) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? -1,
        timedOut: false,
        success: exitCode === 0,
      })
    })

    proc.on('error', (error) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr: error.message,
        exitCode: -1,
        timedOut: false,
        success: false,
      })
    })
  })
})

// Recent workspaces storage - using electron-store (dynamic import for ESM)
let store: any | null = null

async function getStore() {
  if (!store) {
    const { default: Store } = await import('electron-store')
    store = new Store()
  }
  return store
}

ipcMain.handle('recent:get', async () => {
  const s = await getStore()
  return s.get('recent-workspaces', [])
})

ipcMain.handle('recent:add', async (_, workspacePath: string, name: string, description?: string) => {
  const s = await getStore()
  let recent = s.get('recent-workspaces', []) as Array<{ path: string; name: string; description?: string; lastOpened: string }>

  // Remove existing entry for this path
  recent = recent.filter((item) => item.path !== workspacePath)

  // Add new entry at the beginning
  recent.unshift({
    path: workspacePath,
    name,
    description,
    lastOpened: new Date().toISOString(),
  })

  // Keep only last 10
  recent = recent.slice(0, 10)

  s.set('recent-workspaces', recent)
  return recent
})

ipcMain.handle('recent:remove', async (_, workspacePath: string) => {
  const s = await getStore()
  let recent = s.get('recent-workspaces', []) as Array<{ path: string; name: string; lastOpened: string }>

  // Remove entry for this path
  recent = recent.filter((item) => item.path !== workspacePath)

  s.set('recent-workspaces', recent)
  return recent
})

// ==================== OpenAI API Key Storage ====================

// OpenAI: Get API key
ipcMain.handle('openai:getApiKey', async (_, keyId: string) => {
  const s = await getStore()
  const keys = s.get('openai-api-keys', {}) as Record<string, string>
  return keys[keyId] || null
})

// OpenAI: Set API key
ipcMain.handle('openai:setApiKey', async (_, keyId: string, apiKey: string) => {
  const s = await getStore()
  const keys = s.get('openai-api-keys', {}) as Record<string, string>
  keys[keyId] = apiKey
  s.set('openai-api-keys', keys)
  return true
})

// OpenAI: Delete API key
ipcMain.handle('openai:deleteApiKey', async (_, keyId: string) => {
  const s = await getStore()
  const keys = s.get('openai-api-keys', {}) as Record<string, string>
  delete keys[keyId]
  s.set('openai-api-keys', keys)
  return true
})

// HTTP: Fetch URL
interface HttpFetchOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
}

ipcMain.handle('http:fetch', async (_, options: HttpFetchOptions) => {
  const { url, method = 'GET', headers = {}, body, timeout = 30000 } = options

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const text = await response.text()

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      body: text,
    }
  } catch (error) {
    return {
      success: false,
      status: 0,
      statusText: '',
      body: '',
      error: (error as Error).message,
    }
  }
})

// ==================== Browser IPC Handlers ====================

// Browser: Initialize browser
ipcMain.handle('browser:init', async (_, workspacePath: string, options?: BrowserInitOptions) => {
  const manager = getBrowserManager(workspacePath)
  return manager.init(options)
})

// Browser: Close browser
ipcMain.handle('browser:close', async (_, workspacePath: string) => {
  await closeBrowserManager(workspacePath)
  return { success: true }
})

// Browser: Get status
ipcMain.handle('browser:getStatus', async (_, workspacePath: string) => {
  const manager = getBrowserManager(workspacePath)
  return manager.getStatus()
})

// Browser: Navigate
ipcMain.handle('browser:navigate', async (_, workspacePath: string, url: string): Promise<NavigateResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.navigate(url)
})

// Browser: Click
ipcMain.handle('browser:click', async (_, workspacePath: string, selector: string, options?: ClickOptions): Promise<ActionResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.click(selector, options)
})

// Browser: Type
ipcMain.handle('browser:type', async (_, workspacePath: string, selector: string, text: string, options?: TypeOptions): Promise<ActionResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.type(selector, text, options)
})

// Browser: Scroll
ipcMain.handle('browser:scroll', async (_, workspacePath: string, options: ScrollOptions): Promise<ActionResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.scroll(options)
})

// Browser: Screenshot
ipcMain.handle('browser:screenshot', async (_, workspacePath: string, options?: ScreenshotOptions): Promise<ScreenshotResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.screenshot(options)
})

// Browser: Get Content
ipcMain.handle('browser:getContent', async (_, workspacePath: string, options: GetContentOptions): Promise<ContentResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.getContent(options)
})

// Browser: Evaluate JavaScript
ipcMain.handle('browser:evaluate', async (_, workspacePath: string, script: string): Promise<EvaluateResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.evaluate(script)
})

// Browser: Wait for selector
ipcMain.handle('browser:waitForSelector', async (_, workspacePath: string, selector: string, options?: WaitOptions): Promise<ActionResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.waitForSelector(selector, options)
})

// Browser: Wait for timeout
ipcMain.handle('browser:waitForTimeout', async (_, workspacePath: string, ms: number) => {
  const manager = getBrowserManager(workspacePath)
  return manager.waitForTimeout(ms)
})

// Browser: Get tabs
ipcMain.handle('browser:getTabs', async (_, workspacePath: string): Promise<TabInfo[]> => {
  const manager = getBrowserManager(workspacePath)
  return manager.getTabs()
})

// Browser: Switch tab
ipcMain.handle('browser:switchTab', async (_, workspacePath: string, tabId: string): Promise<ActionResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.switchTab(tabId)
})

// Browser: New tab
ipcMain.handle('browser:newTab', async (_, workspacePath: string, url?: string): Promise<TabInfo> => {
  const manager = getBrowserManager(workspacePath)
  return manager.newTab(url)
})

// Browser: Close tab
ipcMain.handle('browser:closeTab', async (_, workspacePath: string, tabId: string): Promise<ActionResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.closeTab(tabId)
})

// Browser: Go back
ipcMain.handle('browser:goBack', async (_, workspacePath: string): Promise<ActionResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.goBack()
})

// Browser: Go forward
ipcMain.handle('browser:goForward', async (_, workspacePath: string): Promise<ActionResult> => {
  const manager = getBrowserManager(workspacePath)
  return manager.goForward()
})

// File Watcher: Start watching workspace directory
ipcMain.handle('fileWatcher:start', (event, workspacePath: string) => {
  if (fileWatchers.has(workspacePath)) {
    return { success: true, message: 'Already watching' }
  }

  try {
    const watcher = fsWatch.watch(workspacePath, { recursive: true }, (eventType, filename) => {
      if (filename && !filename.startsWith('.ollamaflow') && !filename.startsWith('.')) {
        mainWindow?.webContents.send('fileWatcher:changed', { workspacePath, eventType, filename })
      }
    })

    watcher.on('error', (error) => {
      console.error('File watcher error:', error)
      fileWatchers.delete(workspacePath)
    })

    fileWatchers.set(workspacePath, watcher)
    return { success: true, message: 'Started watching' }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// File Watcher: Stop watching workspace directory
ipcMain.handle('fileWatcher:stop', (_, workspacePath: string) => {
  const watcher = fileWatchers.get(workspacePath)
  if (watcher) {
    watcher.close()
    fileWatchers.delete(workspacePath)
    return { success: true, message: 'Stopped watching' }
  }
  return { success: true, message: 'Was not watching' }
})

// ==================== Execution Status Storage ====================

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

// Execution: Get all execution statuses
ipcMain.handle('execution:getAllStatuses', async () => {
  const s = await getStore()
  return s.get('execution-statuses', {}) as Record<string, WorkspaceExecutionStatus>
})

// Execution: Get status for a specific workspace
ipcMain.handle('execution:getStatus', async (_, workspacePath: string) => {
  const s = await getStore()
  const statuses = s.get('execution-statuses', {}) as Record<string, WorkspaceExecutionStatus>
  return statuses[workspacePath] || null
})

// Execution: Update status
ipcMain.handle('execution:updateStatus', async (_, status: WorkspaceExecutionStatus) => {
  const s = await getStore()
  const statuses = s.get('execution-statuses', {}) as Record<string, WorkspaceExecutionStatus>
  statuses[status.workspacePath] = status
  s.set('execution-statuses', statuses)
  return status
})

// Execution: Clear status for a workspace
ipcMain.handle('execution:clearStatus', async (_, workspacePath: string) => {
  const s = await getStore()
  const statuses = s.get('execution-statuses', {}) as Record<string, WorkspaceExecutionStatus>
  delete statuses[workspacePath]
  s.set('execution-statuses', statuses)
  return true
})

// Execution: Start workflow for a workspace
ipcMain.handle('execution:start', async (_, workspacePath: string) => {
  const status: WorkspaceExecutionStatus = {
    workspacePath,
    status: 'running',
    startTime: new Date().toISOString(),
    progress: 0,
    totalNodes: 0,
    completedNodes: 0,
  }
  const s = await getStore()
  const statuses = s.get('execution-statuses', {}) as Record<string, WorkspaceExecutionStatus>
  statuses[workspacePath] = status
  s.set('execution-statuses', statuses)
  return status
})

// Execution: Pause workflow for a workspace
ipcMain.handle('execution:pause', async (_, workspacePath: string) => {
  const s = await getStore()
  const statuses = s.get('execution-statuses', {}) as Record<string, WorkspaceExecutionStatus>
  const status = statuses[workspacePath]
  if (status) {
    status.status = 'running' // Keep as running since we don't have 'paused' in the union
    s.set('execution-statuses', statuses)
  }
  return status || null
})

// Execution: Resume workflow for a workspace
ipcMain.handle('execution:resume', async (_, workspacePath: string) => {
  const s = await getStore()
  const statuses = s.get('execution-statuses', {}) as Record<string, WorkspaceExecutionStatus>
  const status = statuses[workspacePath]
  if (status) {
    status.status = 'running'
    s.set('execution-statuses', statuses)
  }
  return status || null
})

// Execution: Cancel workflow for a workspace
ipcMain.handle('execution:cancel', async (_, workspacePath: string) => {
  const s = await getStore()
  const statuses = s.get('execution-statuses', {}) as Record<string, WorkspaceExecutionStatus>
  const status = statuses[workspacePath]
  if (status) {
    status.status = 'cancelled'
    status.endTime = new Date().toISOString()
    s.set('execution-statuses', statuses)
  }
  return status || null
})
