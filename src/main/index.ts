import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { spawn } from 'child_process'

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

// Workspace: Initialize a new workspace
ipcMain.handle('workspace:init', async (_, workspacePath: string, config: { name: string }) => {
  const ollamaflowDir = path.join(workspacePath, '.ollamaflow')
  const configPath = path.join(ollamaflowDir, 'config.json')
  const workflowPath = path.join(ollamaflowDir, 'workflow.json')

  // Create .ollamaflow directory
  await fs.mkdir(ollamaflowDir, { recursive: true })
  await fs.mkdir(path.join(ollamaflowDir, 'cache'), { recursive: true })

  // Create config.json
  const configData = {
    name: config.name,
    description: '',
    ollamaHost: 'http://127.0.0.1:11434',
    defaultModel: 'llama3.1',
    created: new Date().toISOString(),
    lastOpened: new Date().toISOString(),
  }
  await fs.writeFile(configPath, JSON.stringify(configData, null, 2))

  // Create empty workflow.json
  const workflowData = {
    metadata: {
      id: crypto.randomUUID(),
      name: config.name,
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
    
    // Determine MIME type based on file extension
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

ipcMain.handle('recent:add', async (_, workspacePath: string, name: string) => {
  const s = await getStore()
  let recent = s.get('recent-workspaces', []) as Array<{ path: string; name: string; lastOpened: string }>

  // Remove existing entry for this path
  recent = recent.filter((item) => item.path !== workspacePath)

  // Add new entry at the beginning
  recent.unshift({
    path: workspacePath,
    name,
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
