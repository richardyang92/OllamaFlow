import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
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

  // 设置精简的应用菜单
  const template: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
    {
      label: '文件',
      submenu: [
        { role: 'close', label: '关闭窗口' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 OllamaFlow',
          click: async () => {
            const { dialog } = await import('electron')
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于 OllamaFlow',
              message: 'OllamaFlow',
              detail: '版本: 1.0.0\n可视化工作流构建工具\n\n基于 Ollama 的 AI 工作流编辑器'
            })
          }
        }
      ]
    }
  ]

  // 开发环境添加开发者工具菜单
  if (process.env.NODE_ENV === 'development') {
    const viewMenu = template.find(item => item.label === '视图')
    if (viewMenu && 'submenu' in viewMenu && Array.isArray(viewMenu.submenu)) {
      viewMenu.submenu.push(
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' }
      )
    }
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
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

// Workspace: Check if path exists
ipcMain.handle('workspace:exists', async (_, absolutePath: string) => {
  try {
    await fs.access(absolutePath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('workspace:init', async (_, workspacePath: string, options: WorkspaceInitOptions) => {
  const ollamaflowDir = path.join(workspacePath, '.ollamaflow')
  const configPath = path.join(ollamaflowDir, 'config.json')
  const workflowPath = path.join(ollamaflowDir, 'workflow.json')

  // Create .ollamaflow directory
  await fs.mkdir(ollamaflowDir, { recursive: true })
  await fs.mkdir(path.join(ollamaflowDir, 'cache'), { recursive: true })

  // Create config.json with provided options
  // Note: AI config is now stored globally, not per-workspace
  const configData = {
    name: options.name,
    description: options.description || '',
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
    let config = JSON.parse(content)

    // Migration: Convert old ollamaHost to apiEndpoint
    if (config.ollamaHost && !config.apiEndpoint) {
      // Convert Ollama host to OpenAI-compatible endpoint
      config.apiEndpoint = config.ollamaHost.replace(/\/$/, '') + '/v1'
      delete config.ollamaHost

      // Save migrated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    }

    return config
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

// Workspace: Rename workspace folder
ipcMain.handle('workspace:rename', async (_, workspacePath: string, newName: string) => {
  try {
    const parentDir = path.dirname(workspacePath)
    const newPath = path.join(parentDir, newName)

    // Check if target path already exists
    try {
      await fs.access(newPath)
      return { success: false, error: '目标目录已存在' }
    } catch {
      // Target doesn't exist, proceed
    }

    await fs.rename(workspacePath, newPath)

    // Update config with new name
    const configPath = path.join(newPath, '.ollamaflow', 'config.json')
    const existingContent = await fs.readFile(configPath, 'utf-8')
    const existingConfig = JSON.parse(existingContent)
    const updatedConfig = { ...existingConfig, name: newName, lastOpened: new Date().toISOString() }
    await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2))

    return { success: true, newPath, config: updatedConfig }
  } catch (error) {
    console.error('重命名工作区失败:', error)
    return { success: false, error: (error as Error).message }
  }
})

// Workflow: Export workflow to file
ipcMain.handle('workflow:export', async (_, workflowData: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: '导出工作流',
    defaultPath: 'workflow.ollamaflow',
    filters: [{ name: 'OllamaFlow Workflow', extensions: ['ollamaflow', 'json'] }]
  })

  if (result.canceled || !result.filePath) return null

  await fs.writeFile(result.filePath, workflowData, 'utf-8')
  return result.filePath
})

// Workflow: Import workflow from file
ipcMain.handle('workflow:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '导入工作流',
    filters: [{ name: 'OllamaFlow Workflow', extensions: ['ollamaflow', 'json'] }],
    properties: ['openFile']
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const content = await fs.readFile(result.filePaths[0], 'utf-8')
  return content
})

// File: Read file
ipcMain.handle('file:read', async (_, workspacePath: string, relativePath: string) => {
  const fullPath = path.join(workspacePath, relativePath)

  try {
    const content = await fs.readFile(fullPath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    console.error('[FILE_READ] 文件读取失败', {
      path: fullPath,
      error: (error as Error).message,
    })
    return { success: false, error: (error as Error).message }
  }
})

// File: Write file
ipcMain.handle('file:write', async (_, workspacePath: string, relativePath: string, content: string) => {
  const fullPath = path.join(workspacePath, relativePath)

  try {
    const dirToCreate = path.dirname(fullPath)
    await fs.mkdir(dirToCreate, { recursive: true })
    await fs.writeFile(fullPath, content, 'utf-8')

    return { success: true }
  } catch (error) {
    console.error('[FILE_WRITE] 文件写入失败', {
      path: fullPath,
      error: (error as Error).message,
    })
    return { success: false, error: (error as Error).message }
  }
})

// File: List files in directory
ipcMain.handle('file:list', async (_, workspacePath: string, relativePath: string = '') => {
  const fullPath = path.join(workspacePath, relativePath)
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    const files = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(fullPath, entry.name)
      let mtime: number | undefined
      let size: number | undefined
      if (!entry.isDirectory()) {
        try {
          const stats = await fs.stat(entryPath)
          mtime = stats.mtimeMs
          size = stats.size
        } catch {
          // 忽略 stat 错误
        }
      }
      return {
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(relativePath, entry.name),
        mtime,
        size,
      }
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
    } else if (ext === '.svg') {
      mimeType = 'image/svg+xml'
    } else if (ext === '.ico') {
      mimeType = 'image/x-icon'
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

// File: Copy file from source to destination
ipcMain.handle('file:copy', async (_, sourcePath: string, destPath: string) => {
  try {
    // Ensure destination directory exists
    const destDir = path.dirname(destPath)
    await fs.mkdir(destDir, { recursive: true })
    
    // Copy file
    await fs.copyFile(sourcePath, destPath)
    
    return { success: true }
  } catch (error) {
    console.error('[FILE_COPY] 文件复制失败', {
      source: sourcePath,
      dest: destPath,
      error: (error as Error).message,
    })
    return { success: false, error: (error as Error).message }
  }
})

// File: Copy multiple files
ipcMain.handle('file:copyFiles', async (_, files: Array<{ sourcePath: string; destPath: string }>) => {
  const results: Array<{ sourcePath: string; destPath: string; success: boolean; error?: string }> = []
  
  for (const { sourcePath, destPath } of files) {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destPath)
      await fs.mkdir(destDir, { recursive: true })
      
      // Copy file
      await fs.copyFile(sourcePath, destPath)
      results.push({ sourcePath, destPath, success: true })
    } catch (error) {
      console.error('[FILE_COPY] 文件复制失败', {
        source: sourcePath,
        dest: destPath,
        error: (error as Error).message,
      })
      results.push({ sourcePath, destPath, success: false, error: (error as Error).message })
    }
  }
  
  return { success: results.every(r => r.success), results }
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

// ==================== Workflow Discovery ====================

// Workflow: Discover all workflows from recent workspaces
ipcMain.handle('workflow:discoverAll', async () => {
  try {
    const s = await getStore()
    const recent = s.get('recent-workspaces', []) as Array<{
      path: string
      name: string
      description?: string
      lastOpened: string
    }>

    const workflows: Array<{
      id: string
      workspacePath: string
      name: string
      description?: string
    }> = []

    for (let i = 0; i < recent.length; i++) {
      const workspace = recent[i]
      try {
        // Check if workspace still exists
        const configPath = path.join(workspace.path, '.ollamaflow', 'config.json')
        await fs.access(configPath)

        // 使用索引生成唯一 ID，避免中文命名冲突
        const id = `wf_${i}`

        workflows.push({
          id,
          workspacePath: workspace.path,
          name: workspace.name,
          description: workspace.description,
        })
      } catch {
        // Workspace no longer exists, skip it
      }
    }

    return workflows
  } catch (error) {
    console.error('Failed to discover workflows:', error)
    return []
  }
})

// Workflow: Load workflow data from a workspace
ipcMain.handle('workflow:loadData', async (_, workspacePath: string) => {
  try {
    const workflowPath = path.join(workspacePath, '.ollamaflow', 'workflow.json')
    const content = await fs.readFile(workflowPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
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

// ==================== Agent Config Storage ====================

// Agent: Get config
ipcMain.handle('agent:getConfig', async () => {
  const s = await getStore()
  return s.get('agent-config', null) as {
    provider: 'ollama' | 'openai'
    model: string
    apiEndpoint?: string
    apiKey?: string
  } | null
})

// Agent: Set config
ipcMain.handle('agent:setConfig', async (_, config: {
  provider: 'ollama' | 'openai'
  model: string
  apiEndpoint?: string
  apiKey?: string
}) => {
  const s = await getStore()
  s.set('agent-config', config)
  return true
})

// Agent: Get conversation history
ipcMain.handle('agent:getConversationHistory', async () => {
  const s = await getStore()
  return s.get('agent-conversation-history', null) as {
    conversations: Array<{
      id: string
      title: string
      createdAt: number
      updatedAt: number
      messageCount: number
      preview?: string
    }>
    currentConversationId: string | null
  } | null
})

// Agent: Save conversation history
ipcMain.handle('agent:saveConversationHistory', async (_, history: {
  conversations: Array<{
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messageCount: number
    preview?: string
  }>
  currentConversationId: string | null
}) => {
  const s = await getStore()
  s.set('agent-conversation-history', history)
  return true
})

// Agent: Get conversation messages
ipcMain.handle('agent:getConversation', async (_, id: string) => {
  const s = await getStore()
  const key = `agent-conversation-${id}`
  return s.get(key, null) as {
    meta: {
      id: string
      title: string
      createdAt: number
      updatedAt: number
      messageCount: number
      preview?: string
    }
    messages: unknown[]
  } | null
})

// Agent: Save conversation messages
ipcMain.handle('agent:saveConversation', async (_, id: string, messages: unknown[]) => {
  const s = await getStore()
  const key = `agent-conversation-${id}`
  s.set(key, { messages, savedAt: Date.now() })
  return true
})

// Agent: Delete conversation
ipcMain.handle('agent:deleteConversation', async (_, id: string) => {
  const s = await getStore()
  const key = `agent-conversation-${id}`
  s.delete(key)
  return true
})

// ==================== Agent Sandbox ====================

// 沙箱目录基础路径（工作区根目录下的独立隐藏目录）
const getAgentSandboxBasePath = (workspacePath: string) =>
  path.join(workspacePath, '.agent-sandbox')

// Agent: Create sandbox directory for conversation
ipcMain.handle('agent:createSandbox', async (_, workspacePath: string, conversationId: string) => {
  const basePath = getAgentSandboxBasePath(workspacePath)
  const sandboxPath = path.join(basePath, conversationId)

  try {
    await fs.mkdir(sandboxPath, { recursive: true })
    return { success: true, path: sandboxPath }
  } catch (error) {
    console.error('[agent:createSandbox] 目录创建失败', {
      path: sandboxPath,
      error: (error as Error).message,
    })
    return { success: false, error: (error as Error).message }
  }
})

// Agent: Delete sandbox directory for conversation
ipcMain.handle('agent:deleteSandbox', async (_, workspacePath: string, conversationId: string) => {
  const sandboxPath = path.join(getAgentSandboxBasePath(workspacePath), conversationId)
  try {
    await fs.rm(sandboxPath, { recursive: true, force: true })
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// Agent: Get sandbox path for conversation
ipcMain.handle('agent:getSandboxPath', async (_, workspacePath: string, conversationId: string) => {
  return path.join(getAgentSandboxBasePath(workspacePath), conversationId)
})

// Agent: Get default sandbox path (when no workspace is open)
ipcMain.handle('agent:getDefaultSandboxPath', async (_, conversationId: string) => {
  const basePath = path.join(app.getPath('userData'), 'agent-sandbox')
  return path.join(basePath, conversationId)
})

// Agent: Create default sandbox directory
ipcMain.handle('agent:createDefaultSandbox', async (_, conversationId: string) => {
  const basePath = path.join(app.getPath('userData'), 'agent-sandbox')
  const sandboxPath = path.join(basePath, conversationId)

  try {
    await fs.mkdir(sandboxPath, { recursive: true })
    return { success: true, path: sandboxPath }
  } catch (error) {
    console.error('[agent:createDefaultSandbox] 沙箱目录创建失败', {
      path: sandboxPath,
      error: (error as Error).message,
    })
    return { success: false, error: (error as Error).message }
  }
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
ipcMain.handle('fileWatcher:start', (_event, workspacePath: string) => {
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

// ==================== Global AI Config ====================

// GlobalAI: Get config
ipcMain.handle('globalAI:getConfig', async () => {
  const s = await getStore()
  return s.get('global-ai-config', null) as {
    enabled: boolean
    apiEndpoint: string
    defaultModel?: string
    provider: 'ollama' | 'openai' | 'deepseek' | 'vllm' | 'custom'
    name?: string
  } | null
})

// GlobalAI: Set config (without API key)
ipcMain.handle('globalAI:setConfig', async (_, config: {
  enabled: boolean
  apiEndpoint: string
  defaultModel?: string
  provider: 'ollama' | 'openai' | 'deepseek' | 'vllm' | 'custom'
  name?: string
}) => {
  const s = await getStore()
  s.set('global-ai-config', config)
  return true
})

// GlobalAI: Get API key
ipcMain.handle('globalAI:getApiKey', async () => {
  const s = await getStore()
  return s.get('global-api-key', null) as string | null
})

// GlobalAI: Set API key
ipcMain.handle('globalAI:setApiKey', async (_, apiKey: string) => {
  const s = await getStore()
  s.set('global-api-key', apiKey)
  return true
})

// GlobalAI: Delete API key
ipcMain.handle('globalAI:deleteApiKey', async () => {
  const s = await getStore()
  s.delete('global-api-key')
  return true
})

// GlobalAI: Clear all config
ipcMain.handle('globalAI:clearConfig', async () => {
  const s = await getStore()
  s.delete('global-ai-config')
  s.delete('global-api-key')
  return true
})

// GlobalAI: Test connection and fetch models
ipcMain.handle('globalAI:testConnection', async (_, config: { apiEndpoint: string; apiKey?: string }) => {
  try {
    const response = await fetch(`${config.apiEndpoint}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(15000)
    })

    if (response.ok) {
      const json = await response.json()
      return {
        success: true,
        models: (json.data || []).map((m: { id: string; name?: string; owned_by?: string }) => ({
          id: m.id,
          name: m.name || m.id,
          owned_by: m.owned_by
        }))
      }
    }
    return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// ==================== SimpleXNG Config ====================

// SimpleXNG: Get endpoint
ipcMain.handle('simplexng:getEndpoint', async () => {
  const s = await getStore()
  return s.get('simplexng-endpoint', 'http://localhost:8888') as string
})

// SimpleXNG: Set endpoint
ipcMain.handle('simplexng:setEndpoint', async (_, endpoint: string) => {
  const s = await getStore()
  s.set('simplexng-endpoint', endpoint)
  return true
})

// ============================================
// Web Parser IPC Handlers
// ============================================

import { parseHtmlContent, isHtmlContent } from './web-parser'

interface WebParserOptions {
  maxContentLength?: number
  includeLinks?: boolean
  outputFormat?: 'markdown' | 'text'
}

// Web Parser: Parse HTML content
ipcMain.handle('webParser:parseHtml', async (_, html: string, baseUrl?: string, options?: WebParserOptions) => {
  try {
    return parseHtmlContent(html, baseUrl, options)
  } catch (error) {
    return {
      title: '',
      mainContent: '',
      textContent: '',
      links: [],
      error: `解析失败: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
})

// Web Parser: Fetch URL and parse
ipcMain.handle('webParser:fetchAndParse', async (_, url: string, options?: WebParserOptions & { timeout?: number }) => {
  try {
    const timeout = options?.timeout || 30000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OllamaFlowBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        title: '',
        mainContent: '',
        textContent: '',
        links: [],
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const html = await response.text()
    return parseHtmlContent(html, url, options)
  } catch (error) {
    return {
      title: '',
      mainContent: '',
      textContent: '',
      links: [],
      error: `获取失败: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
})

// Web Parser: Check if content is HTML
ipcMain.handle('webParser:isHtml', async (_, content: string) => {
  return isHtmlContent(content)
})

// ==================== Agent Execution Analytics ====================

interface AnalyticsHistoryItem {
  executionId: string
  timestamp: number
  query: string
  duration: number
  iterationCount: number
  toolCallCount: number
  success: boolean
  overallScore: number
}

// Analytics: Get execution history
ipcMain.handle('analytics:getHistory', async () => {
  const s = await getStore()
  return s.get('agent-analytics-history', null) as AnalyticsHistoryItem[] | null
})

// Analytics: Save execution history
ipcMain.handle('analytics:saveHistory', async (_, history: AnalyticsHistoryItem[]) => {
  const s = await getStore()
  s.set('agent-analytics-history', history)
  return true
})

// Analytics: Clear execution history
ipcMain.handle('analytics:clearHistory', async () => {
  const s = await getStore()
  s.set('agent-analytics-history', [])
  return true
})
