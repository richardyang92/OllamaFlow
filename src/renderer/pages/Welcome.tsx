import { useState, useEffect, useRef } from 'react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useExecutionStore } from '@/store/execution-store'
import { createEmptyWorkflow } from '@/types/workflow'
import { useResolvedTheme } from '@/contexts/ThemeContext'
import {
  DashboardHeader,
  WorkspaceCard,
  NewWorkspaceCard,
  WorkspaceGrid,
} from '@/components/dashboard'

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
        const pointColor = isDark
          ? `rgba(255, 255, 255, ${alpha})`
          : `rgba(0, 0, 0, ${alpha * 0.5})`
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

        const particleColor = isDark
          ? `rgba(255, 255, 255, ${alpha})`
          : `rgba(0, 0, 0, ${alpha * 0.5})`
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
  const { setCurrentWorkspace, setRecentWorkspaces, recentWorkspaces, setCurrentPage } =
    useWorkspaceStore()
  const { setWorkflow, syncEdgeAnimation } = useWorkflowStore()
  const [isLoading, setIsLoading] = useState(false)
  const [executionStatuses, setExecutionStatuses] = useState<Record<string, {
    status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
    progress: number
    totalNodes: number
    completedNodes: number
    currentNode?: string
    error?: string
    startTime?: string
    endTime?: string
  }>>({})

  useEffect(() => {
    window.electronAPI.recent.get().then(setRecentWorkspaces)
  }, [setRecentWorkspaces])

  useEffect(() => {
    window.electronAPI.execution.getAllStatuses().then((statuses) => {
      const filtered: typeof executionStatuses = {}
      for (const [path, status] of Object.entries(statuses)) {
        if (status.status === 'running' || status.status === 'completed' || status.status === 'failed') {
          filtered[path] = status
        }
      }
      setExecutionStatuses(filtered)
    })
  }, [recentWorkspaces])

  const handleNewProject = () => {
    setCurrentPage('wizard')
  }

  const handleOpenRecent = async (path: string) => {
    setIsLoading(true)
    
    try {
      const config = await window.electronAPI.workspace.readConfig(path)
      if (config) {
        await window.electronAPI.recent.add(path, config.name)
        setCurrentWorkspace(path, config)
        
        useExecutionStore.getState().switchWorkspaceContext(path)
        
        const workflow = await window.electronAPI.workspace.readWorkflow(path)
        if (workflow) {
          setWorkflow(workflow as any)
          
          const executionStore = useExecutionStore.getState()
          const workspaceState = executionStore.workspaces.get(path)
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

  const handleRemoveRecent = async (path: string) => {
    await window.electronAPI.recent.remove(path)
    const updatedRecentWorkspaces = await window.electronAPI.recent.get()
    setRecentWorkspaces(updatedRecentWorkspaces)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-canvas)] text-[var(--color-text)]">
      <AnimatedBackground />
      <DashboardHeader />

      <WorkspaceGrid>
        {recentWorkspaces.map((workspace) => (
          <WorkspaceCard
            key={workspace.path}
            workspace={workspace}
            executionStatus={executionStatuses[workspace.path] || null}
            onOpen={handleOpenRecent}
            onRemove={handleRemoveRecent}
            isLoading={isLoading}
          />
        ))}
        <NewWorkspaceCard onClick={handleNewProject} isLoading={isLoading} />
      </WorkspaceGrid>

      <div className="fixed bottom-6 left-0 right-0 text-center text-[var(--color-text-muted)] text-sm">
        v0.1.0 • 由 Ollama 驱动
      </div>
    </div>
  )
}
