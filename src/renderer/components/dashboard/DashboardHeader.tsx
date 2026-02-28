import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Sun, Moon, Monitor, Wifi, WifiOff, Loader2, FolderOpen } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useExecutionStore } from '@/store/execution-store'
import { createEmptyWorkflow } from '@/types/workflow'

async function checkOllamaStatus(ollamaHost: string): Promise<'online' | 'offline'> {
  try {
    const response = await fetch(`${ollamaHost}/api/tags`, {
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
  const { setWorkflow, syncEdgeAnimation } = useWorkflowStore()
  const [aiStatus, setAiStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [isOpeningProject, setIsOpeningProject] = useState(false)

  useEffect(() => {
    setAiStatus('checking')
    checkOllamaStatus('http://localhost:11434').then(setAiStatus)
  }, [])

  const handleThemeToggle = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(themeMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setThemeMode(nextMode)
  }

  const handleOpenProject = async () => {
    if (isOpeningProject) return
    
    setIsOpeningProject(true)
    try {
      const selectedPath = await window.electronAPI.workspace.open()
      
      if (!selectedPath) {
        setIsOpeningProject(false)
        return
      }

      const config = await window.electronAPI.workspace.readConfig(selectedPath)
      
      if (!config) {
        alert('所选文件夹不是有效的 OllamaFlow 工作区')
        setIsOpeningProject(false)
        return
      }

      await window.electronAPI.recent.add(selectedPath, config.name)
      setCurrentWorkspace(selectedPath, config)
      useExecutionStore.getState().switchWorkspaceContext(selectedPath)
      
      const workflow = await window.electronAPI.workspace.readWorkflow(selectedPath)
      if (workflow) {
        setWorkflow(workflow as any)
        
        const executionStore = useExecutionStore.getState()
        const workspaceState = executionStore.workspaces.get(selectedPath)
        if (workspaceState?.status === 'running' && workspaceState.context?.nodeResults) {
          const runningNodeIds: string[] = []
          workspaceState.context.nodeResults.forEach((result, nodeId) => {
            if (result.status === 'running') {
              runningNodeIds.push(nodeId)
            }
          })
          if (runningNodeIds.length > 0) {
            syncEdgeAnimation(runningNodeIds)
          }
        }
      } else {
        setWorkflow(createEmptyWorkflow(config.name))
      }

      const updatedRecentWorkspaces = await window.electronAPI.recent.get()
      setRecentWorkspaces(updatedRecentWorkspaces)
    } catch (error) {
      console.error('打开项目失败:', error)
      alert('打开项目失败')
    } finally {
      setIsOpeningProject(false)
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
            onClick={handleOpenProject}
            disabled={isOpeningProject}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm',
              'glass-floating',
              'text-[var(--color-text-muted)]',
              'hover:text-[var(--color-text)]',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            whileHover={{ scale: isOpeningProject ? 1 : 1.05 }}
            whileTap={{ scale: isOpeningProject ? 1 : 0.95 }}
            title="打开现有项目"
          >
            {isOpeningProject ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
            <span>打开项目</span>
          </motion.button>

          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
              'glass-floating'
            )}
          >
            {aiStatus === 'checking' ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-muted)]" />
            ) : aiStatus === 'online' ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <span className="text-[var(--color-text-muted)]">
              Ollama {aiStatus === 'online' ? '在线' : aiStatus === 'offline' ? '离线' : '检测中'}
            </span>
          </div>

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
    </header>
  )
}
