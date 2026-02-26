import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Bot, Sparkles, FolderOpen, Sun, Moon, Monitor, Folder } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { createEmptyWorkflow } from '@/types/workflow'
import { useTheme, type ThemeMode, useResolvedTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resolvedTheme = useResolvedTheme()
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const curves: Array<{
      startX: number
      startY: number
      cp1X: number
      cp1Y: number
      cp2X: number
      cp2Y: number
      endX: number
      endY: number
      speed: number
      offset: number
      color: string
      width: number
    }> = []

    const darkColors = [
      'rgba(59, 130, 246, 0.3)',
      'rgba(139, 92, 246, 0.3)',
      'rgba(236, 72, 153, 0.2)',
      'rgba(6, 182, 212, 0.25)',
    ]
    
    const lightColors = [
      'rgba(59, 130, 246, 0.25)',
      'rgba(139, 92, 246, 0.25)',
      'rgba(236, 72, 153, 0.15)',
      'rgba(6, 182, 212, 0.2)',
    ]
    
    const colors = isDark ? darkColors : lightColors

    for (let i = 0; i < 8; i++) {
      curves.push({
        startX: Math.random() * canvas.width,
        startY: Math.random() * canvas.height,
        cp1X: Math.random() * canvas.width,
        cp1Y: Math.random() * canvas.height,
        cp2X: Math.random() * canvas.width,
        cp2Y: Math.random() * canvas.height,
        endX: Math.random() * canvas.width,
        endY: Math.random() * canvas.height,
        speed: 0.0003 + Math.random() * 0.0005,
        offset: Math.random() * Math.PI * 2,
        color: colors[i % colors.length],
        width: 1 + Math.random() * 2,
      })
    }

    let animationFrameId: number
    let time = 0

    const animate = () => {
      const bgColor = isDark ? 'rgba(13, 13, 13, 0.05)' : 'rgba(250, 250, 250, 0.05)'
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      time += 1

      curves.forEach((curve) => {
        const t = time * curve.speed + curve.offset

        const startX = curve.startX + Math.sin(t) * 50
        const startY = curve.startY + Math.cos(t * 0.7) * 30
        const cp1X = curve.cp1X + Math.sin(t * 1.3) * 100
        const cp1Y = curve.cp1Y + Math.cos(t * 0.9) * 80
        const cp2X = curve.cp2X + Math.sin(t * 0.8) * 100
        const cp2Y = curve.cp2Y + Math.cos(t * 1.2) * 80
        const endX = curve.endX + Math.cos(t) * 50
        const endY = curve.endY + Math.sin(t * 0.7) * 30

        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY)

        const gradient = ctx.createLinearGradient(startX, startY, endX, endY)
        gradient.addColorStop(0, 'transparent')
        gradient.addColorStop(0.5, curve.color)
        gradient.addColorStop(1, 'transparent')

        ctx.strokeStyle = gradient
        ctx.lineWidth = curve.width
        ctx.lineCap = 'round'
        ctx.stroke()

        const pointAlpha = isDark ? 0.1 : 0.15
        const alpha = pointAlpha + Math.sin(t * 2) * 0.05
        const pointColor = isDark ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha * 0.5})`
        ctx.fillStyle = pointColor
        ctx.beginPath()
        ctx.arc(cp1X, cp1Y, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cp2X, cp2Y, 2, 0, Math.PI * 2)
        ctx.fill()
      })

      for (let i = 0; i < 20; i++) {
        const x = (Math.sin(time * 0.001 + i * 0.5) * 0.5 + 0.5) * canvas.width
        const y = (Math.cos(time * 0.0008 + i * 0.3) * 0.5 + 0.5) * canvas.height
        const size = 1 + Math.sin(time * 0.002 + i) * 0.5
        const baseAlpha = isDark ? 0.1 : 0.08
        const alpha = baseAlpha + Math.sin(time * 0.003 + i * 0.7) * 0.08

        const particleColor = isDark ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha * 0.5})`
        ctx.fillStyle = particleColor
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fill()
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isDark])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ opacity: isDark ? 0.6 : 0.4 }}
    />
  )
}

export default function WelcomePage() {
  const { setCurrentWorkspace, setRecentWorkspaces, recentWorkspaces, setCurrentPage } = useWorkspaceStore()
  const { setWorkflow } = useWorkflowStore()
  const { themeMode, setThemeMode, resolvedTheme } = useTheme()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    window.electronAPI.recent.get().then(setRecentWorkspaces)
  }, [setRecentWorkspaces])

  const handleNewProject = () => {
    setCurrentPage('wizard')
  }

  const handleOpenWorkspace = async () => {
    setIsLoading(true)
    try {
      const path = await window.electronAPI.workspace.open()
      if (!path) {
        setIsLoading(false)
        return
      }

      const config = await window.electronAPI.workspace.readConfig(path)

      if (config) {
        setCurrentWorkspace(path, config)
        const workflow = await window.electronAPI.workspace.readWorkflow(path)
        if (workflow) {
          setWorkflow(workflow as any)
        } else {
          setWorkflow(createEmptyWorkflow(config.name))
        }
      } else {
        const name = path.split(/[/\\]/).pop() || '新工作区'
        const { config: newConfig, workflow: newWorkflow } =
          await window.electronAPI.workspace.init(path, { name })
        setCurrentWorkspace(path, newConfig)
        setWorkflow(newWorkflow as any)
      }
    } catch (error) {
      console.error('打开工作区失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenRecent = async (path: string) => {
    setIsLoading(true)
    try {
      const config = await window.electronAPI.workspace.readConfig(path)
      if (config) {
        setCurrentWorkspace(path, config)
        const workflow = await window.electronAPI.workspace.readWorkflow(path)
        if (workflow) {
          setWorkflow(workflow as any)
        } else {
          setWorkflow(createEmptyWorkflow(config.name))
        }
      } else {
        await window.electronAPI.recent.remove(path)
        const updatedRecentWorkspaces = await window.electronAPI.recent.get()
        setRecentWorkspaces(updatedRecentWorkspaces)
        alert('工作区不存在或已被删除')
      }
    } catch (error) {
      console.error('打开最近工作区失败:', error)
      await window.electronAPI.recent.remove(path)
      const updatedRecentWorkspaces = await window.electronAPI.recent.get()
      setRecentWorkspaces(updatedRecentWorkspaces)
      alert('工作区不存在或已被删除')
    } finally {
      setIsLoading(false)
    }
  }

  const handleThemeToggle = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(themeMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setThemeMode(nextMode)
  }

  const ThemeIcon = themeMode === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--color-bg-canvas)] text-[var(--color-text)]">
      <AnimatedBackground />
      
      <motion.button
        onClick={handleThemeToggle}
        className={cn(
          'fixed top-6 right-6 z-20',
          'w-10 h-10 rounded-full',
          'flex items-center justify-center',
          'glass-floating',
          'text-[var(--color-text-muted)]',
          'hover:text-[var(--color-text)]',
          'transition-all duration-200'
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={`主题: ${themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色'}`}
      >
        <ThemeIcon className="w-5 h-5" />
      </motion.button>

      <div className="text-center mb-12 relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Bot className="w-12 h-12 text-purple-500" />
        </div>
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
          OllamaFlow
        </h1>
        <p className="text-[var(--color-text-muted)] text-lg">Ollama 模型可视化工作流构建工具</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel p-8 space-y-4 w-96 max-w-full relative z-10"
      >
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNewProject}
          disabled={isLoading}
          className={cn(
            'w-full px-6 py-3 rounded-lg',
            'bg-gradient-to-r from-purple-500/80 to-blue-500/80',
            'text-white font-medium',
            'hover:from-purple-500 hover:to-blue-500',
            'transition-all duration-200',
            'flex items-center justify-center gap-2',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Sparkles className="w-4 h-4" />
          新建项目
        </motion.button>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleOpenWorkspace}
          disabled={isLoading}
          className={cn(
            'w-full px-6 py-3 rounded-lg',
            'bg-[var(--color-bg-input)]',
            'border border-[var(--color-border-subtle)]',
            'text-[var(--color-text)] font-medium',
            'hover:border-[var(--color-border)]',
            'hover:bg-[var(--color-bg-hover)]',
            'transition-all duration-200',
            'flex items-center justify-center gap-2',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <FolderOpen className="w-4 h-4" />
          {isLoading ? '加载中...' : '打开工作区'}
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center text-sm pt-4 text-[var(--color-text-muted)]"
        >
          选择一个文件夹来创建或打开工作区
        </motion.p>
      </motion.div>

      {recentWorkspaces.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-12 w-96 relative z-10"
        >
          <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 tracking-wider uppercase text-center">
            最近的工作区
          </h2>
          <div className="space-y-2">
            {recentWorkspaces.map((workspace) => (
              <motion.button
                key={workspace.path}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleOpenRecent(workspace.path)}
                disabled={isLoading}
                className={cn(
                  'w-full px-4 py-3 rounded-lg',
                  'glass-panel',
                  'text-left',
                  'hover:bg-[var(--color-bg-hover)]',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-3">
                  <Folder className="w-5 h-5 text-[var(--color-text-muted)]" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--color-text)] truncate">{workspace.name}</div>
                    <div className="text-sm text-[var(--color-text-muted)] truncate">{workspace.path}</div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      <div className="absolute bottom-6 text-[var(--color-text-muted)] text-sm">
        v0.1.0 • 由 Ollama 驱动
      </div>
    </div>
  )
}
