import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Sun, Moon, Monitor, Wifi, WifiOff, Loader2, Settings, FileDown, Globe } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useExecutionStore } from '@/store/execution-store'
import { useSettingsStore } from '@/store/settings-store'
import GlobalAIConfigPanel from '@/components/settings/GlobalAIConfigPanel'

async function checkOllamaStatus(apiEndpoint: string): Promise<'online' | 'offline'> {
  try {
    const response = await fetch(`${apiEndpoint}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })
    return response.ok ? 'online' : 'offline'
  } catch {
    return 'offline'
  }
}

export function DashboardHeader() {
  const { themeMode, setThemeMode, resolvedTheme } = useTheme()
  const { setCurrentWorkspace, setRecentWorkspaces } = useWorkspaceStore()
  const { setWorkflow } = useWorkflowStore()
  const [aiStatus, setAiStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [defaultProjectsPath, setDefaultProjectsPath] = useState<string>('')
  const [isChangingPath, setIsChangingPath] = useState(false)
  const [isImportingFile, setIsImportingFile] = useState(false)
  const [showGlobalConfig, setShowGlobalConfig] = useState(false)

  const { isGlobalAIEnabled, globalAIConfig } = useSettingsStore()

  const checkStatus = () => {
    setAiStatus('checking')
    checkOllamaStatus('http://localhost:11434').then(setAiStatus)
  }

  useEffect(() => {
    checkStatus()
  }, [])

  useEffect(() => {
    window.electronAPI.workspace.getDefaultProjectsPath().then(setDefaultProjectsPath)
  }, [])

  const handleThemeToggle = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(themeMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setThemeMode(nextMode)
  }

  const handleChangeDefaultPath = async () => {
    if (isChangingPath) return

    setIsChangingPath(true)
    try {
      const selectedPath = await window.electronAPI.workspace.selectCustomProjectsPath()

      if (selectedPath) {
        await window.electronAPI.workspace.setCustomProjectsPath(selectedPath)
        setDefaultProjectsPath(selectedPath)
      }
    } catch (error) {
      console.error('更改默认路径失败:', error)
      alert('更改默认路径失败')
    } finally {
      setIsChangingPath(false)
    }
  }

  const handleImportFromFile = async () => {
    if (isImportingFile) return

    setIsImportingFile(true)
    try {
      // 1. 选择 .ollamaflow 文件
      const content = await window.electronAPI.workflow.import()
      if (!content) return

      // 2. 解析文件内容
      const importedData = JSON.parse(content)
      const { metadata, nodes, edges, viewport } = importedData

      // 3. 获取工作区名称和默认路径
      const baseName = metadata?.name || 'Imported Workflow'
      const defaultPath = await window.electronAPI.workspace.getDefaultProjectsPath()

      // 4. 处理重名：检查目录是否存在
      let workspaceName = baseName
      let counter = 1
      while (await window.electronAPI.workspace.exists(`${defaultPath}/${workspaceName}`)) {
        workspaceName = `${baseName} (${counter})`
        counter++
      }
      const workspacePath = `${defaultPath}/${workspaceName}`

      // 5. 创建工作区（直接传入 initialWorkflow）
      const result = await window.electronAPI.workspace.init(workspacePath, {
        name: workspaceName,
        description: metadata?.description || '',
        apiEndpoint: 'http://localhost:11434',
        defaultModel: '',
        initialWorkflow: {
          metadata: {
            id: window.crypto.randomUUID(),
            name: workspaceName,
            createdAt: metadata?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: metadata?.version || '1.0.0',
          },
          nodes,
          edges,
          viewport: viewport || { x: 0, y: 0, zoom: 1 },
        },
      })

      if (!result) {
        alert('创建工作区失败')
        return
      }

      // 6. 添加到最近列表并打开
      await window.electronAPI.recent.add(workspacePath, result.config.name, result.config.description)
      setCurrentWorkspace(workspacePath, result.config)
      useExecutionStore.getState().switchWorkspaceContext(workspacePath)
      setWorkflow(result.workflow)

      // 7. 更新最近工作区列表
      const updatedRecentWorkspaces = await window.electronAPI.recent.get()
      setRecentWorkspaces(updatedRecentWorkspaces)

    } catch (error) {
      console.error('从文件导入失败:', error)
      alert('导入失败：无效的工作流文件')
    } finally {
      setIsImportingFile(false)
    }
  }

  const ThemeIcon = themeMode === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun
  const themeLabel = themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色'

  return (
    <header className="fixed top-0 left-0 right-0 z-20 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <Bot className="w-8 h-8 text-purple-500" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
            OllamaFlow
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <motion.button
            onClick={handleImportFromFile}
            disabled={isImportingFile}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm',
              'glass-floating',
              'text-[var(--color-text-muted)]',
              'hover:text-[var(--color-text)]',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            whileHover={{ scale: isImportingFile ? 1 : 1.05 }}
            whileTap={{ scale: isImportingFile ? 1 : 0.95 }}
            title="从 .ollamaflow 文件创建新工作区"
          >
            {isImportingFile ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            <span>导入文件</span>
          </motion.button>

          {/* Global AI Config Button */}
          <motion.button
            onClick={() => setShowGlobalConfig(true)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-full text-sm',
              'glass-floating',
              'text-[var(--color-text-muted)]',
              'hover:text-[var(--color-text)]',
              'transition-all duration-200',
              isGlobalAIEnabled && 'ring-2 ring-purple-500/30'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={isGlobalAIEnabled ? `全局配置: ${globalAIConfig?.name || '已启用'}` : '配置全局 AI 端点'}
          >
            <Globe className={cn('w-4 h-4', isGlobalAIEnabled && 'text-purple-400')} />
            <span className="hidden sm:inline">
              {isGlobalAIEnabled ? (globalAIConfig?.name || '全局') : 'AI 配置'}
            </span>
          </motion.button>

          <motion.button
            onClick={handleChangeDefaultPath}
            disabled={isChangingPath}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-full text-sm',
              'glass-floating',
              'text-[var(--color-text-muted)]',
              'hover:text-[var(--color-text)]',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            whileHover={{ scale: isChangingPath ? 1 : 1.05 }}
            whileTap={{ scale: isChangingPath ? 1 : 0.95 }}
            title={`默认保存位置: ${defaultProjectsPath}`}
          >
            {isChangingPath ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">保存位置</span>
          </motion.button>

          <motion.button
            onClick={checkStatus}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
              'glass-floating',
              'text-[var(--color-text-muted)]',
              'hover:text-[var(--color-text)]',
              'transition-all duration-200'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="点击刷新 Ollama 状态"
          >
            {aiStatus === 'checking' ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-muted)]" />
            ) : aiStatus === 'online' ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <span>
              Ollama {aiStatus === 'online' ? '在线' : aiStatus === 'offline' ? '离线' : '检测中'}
            </span>
          </motion.button>

          <motion.button
            onClick={handleThemeToggle}
            className={cn(
              'w-9 h-9 rounded-full',
              'flex items-center justify-center',
              'glass-floating',
              'text-[var(--color-text-muted)]',
              'hover:text-[var(--color-text)]',
              'transition-all duration-200'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={`主题: ${themeLabel}`}
          >
            <ThemeIcon className="w-4 h-4" />
          </motion.button>
        </motion.div>
      </div>

      {/* Global AI Config Panel */}
      <GlobalAIConfigPanel
        isOpen={showGlobalConfig}
        onClose={() => setShowGlobalConfig(false)}
      />
    </header>
  )
}
