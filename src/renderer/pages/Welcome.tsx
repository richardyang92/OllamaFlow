import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { createEmptyWorkflow } from '@/types/workflow'

// Animated background component with Bézier curves
function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    // Curve configuration
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

    const colors = [
      'rgba(59, 130, 246, 0.3)',   // blue
      'rgba(139, 92, 246, 0.3)',   // purple
      'rgba(236, 72, 153, 0.2)',   // pink
      'rgba(6, 182, 212, 0.25)',   // cyan
    ]

    // Initialize curves
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
      ctx.fillStyle = 'rgba(13, 13, 13, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      time += 1

      curves.forEach((curve) => {
        const t = time * curve.speed + curve.offset

        // Animate curve points with sine waves
        const startX = curve.startX + Math.sin(t) * 50
        const startY = curve.startY + Math.cos(t * 0.7) * 30
        const cp1X = curve.cp1X + Math.sin(t * 1.3) * 100
        const cp1Y = curve.cp1Y + Math.cos(t * 0.9) * 80
        const cp2X = curve.cp2X + Math.sin(t * 0.8) * 100
        const cp2Y = curve.cp2Y + Math.cos(t * 1.2) * 80
        const endX = curve.endX + Math.cos(t) * 50
        const endY = curve.endY + Math.sin(t * 0.7) * 30

        // Draw Bézier curve
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY)

        // Gradient stroke
        const gradient = ctx.createLinearGradient(startX, startY, endX, endY)
        gradient.addColorStop(0, 'transparent')
        gradient.addColorStop(0.5, curve.color)
        gradient.addColorStop(1, 'transparent')

        ctx.strokeStyle = gradient
        ctx.lineWidth = curve.width
        ctx.lineCap = 'round'
        ctx.stroke()

        // Draw control points (faint)
        const alpha = 0.1 + Math.sin(t * 2) * 0.05
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.beginPath()
        ctx.arc(cp1X, cp1Y, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cp2X, cp2Y, 2, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw floating particles
      for (let i = 0; i < 20; i++) {
        const x = (Math.sin(time * 0.001 + i * 0.5) * 0.5 + 0.5) * canvas.width
        const y = (Math.cos(time * 0.0008 + i * 0.3) * 0.5 + 0.5) * canvas.height
        const size = 1 + Math.sin(time * 0.002 + i) * 0.5
        const alpha = 0.1 + Math.sin(time * 0.003 + i * 0.7) * 0.08

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
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
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  )
}

export default function WelcomePage() {
  const { setCurrentWorkspace, setRecentWorkspaces, recentWorkspaces } = useWorkspaceStore()
  const { setWorkflow } = useWorkflowStore()
  const [isLoading, setIsLoading] = useState(false)

  // Load recent workspaces on mount
  useEffect(() => {
    window.electronAPI.recent.get().then(setRecentWorkspaces)
  }, [setRecentWorkspaces])

  const handleOpenWorkspace = async () => {
    setIsLoading(true)
    try {
      const path = await window.electronAPI.workspace.open()
      if (!path) {
        setIsLoading(false)
        return
      }

      // Check if it's an existing workspace
      const config = await window.electronAPI.workspace.readConfig(path)

      if (config) {
        // Existing workspace
        setCurrentWorkspace(path, config)
        const workflow = await window.electronAPI.workspace.readWorkflow(path)
        if (workflow) {
          setWorkflow(workflow as any)
        } else {
          setWorkflow(createEmptyWorkflow(config.name))
        }
      } else {
        // New workspace - ask for name
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
        // Workspace doesn't exist, remove from recent workspaces
        await window.electronAPI.recent.remove(path)
        // Update recent workspaces list
        const updatedRecentWorkspaces = await window.electronAPI.recent.get()
        setRecentWorkspaces(updatedRecentWorkspaces)
        // Show error message
        alert('工作区不存在或已被删除')
      }
    } catch (error) {
      console.error('打开最近工作区失败:', error)
      // If error occurs (e.g., path doesn't exist), remove from recent workspaces
      await window.electronAPI.recent.remove(path)
      // Update recent workspaces list
      const updatedRecentWorkspaces = await window.electronAPI.recent.get()
      setRecentWorkspaces(updatedRecentWorkspaces)
      // Show error message
      alert('工作区不存在或已被删除')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d0d0d] text-white">
      <AnimatedBackground />
      <div className="text-center mb-12 relative z-10">
        <h1 className="text-5xl font-bold mb-4">🤖 OllamaFlow</h1>
        <p className="text-zinc-400 text-lg">Ollama 模型可视化工作流构建工具</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel-heavy p-10 space-y-8 w-96 max-w-full relative z-10"
      >
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleOpenWorkspace}
          disabled={isLoading}
          className="btn-sci-fi btn-primary btn-lg btn-spotlight w-full"
        >
          <span className="relative z-10">
            {isLoading ? '加载中...' : '📂 打开工作区'}
          </span>
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center text-base"
          style={{ color: '#E0E0E0' }}
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
          <h2 className="text-sm font-medium text-zinc-400 mb-3 tracking-wider uppercase text-center">最近的工作区</h2>
          <div className="space-y-2">
            {recentWorkspaces.map((workspace) => (
              <motion.button
                key={workspace.path}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleOpenRecent(workspace.path)}
                disabled={isLoading}
                className="btn-sci-fi btn-ghost w-full text-center hover-brighten"
                style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
              >
                <div className="flex items-center justify-center gap-3">
                  <span className="text-xl">📁</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-100">{workspace.name}</div>
                    <div className="text-sm text-zinc-500 truncate">{workspace.path}</div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      <div className="absolute bottom-6 text-zinc-600 text-sm">
        v0.1.0 • 由 Ollama 驱动
      </div>
    </div>
  )
}
