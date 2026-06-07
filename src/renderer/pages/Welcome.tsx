import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useExecutionStore } from '@/store/execution-store'
import { createEmptyWorkflow } from '@/types/workflow'
import { useResolvedTheme } from '@/contexts/ThemeContext'
import {
  WorkspaceCard,
  NewWorkspaceCard,
  AddWorkspaceCard,
  WorkspaceGrid,
  AgentFloatingButton,
} from '@/components/dashboard'
import { ConfirmDialog } from '@/components/common'
import { AppHeader } from '@/components/layout'

/**
 * macOS 26 Liquid Glass Animated Background
 * Features:
 * - Flowing gradient orbs with blur effects
 * - Subtle particle system
 * - Theme-aware colors
 * - Performance optimized with requestAnimationFrame
 */
function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resolvedTheme = useResolvedTheme()
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.scale(dpr, dpr)
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // macOS 26 inspired gradient orbs
    interface GradientOrb {
      x: number
      y: number
      radius: number
      color1: string
      color2: string
      speedX: number
      speedY: number
      phase: number
      pulseSpeed: number
    }

    const orbs: GradientOrb[] = []

    // Dark mode colors - subtle, cool tones
    const darkOrbColors = [
      { c1: 'rgba(80, 85, 100, 0.06)', c2: 'rgba(70, 75, 90, 0.03)' },  // Cool gray -> subtle blue
      { c1: 'rgba(60, 65, 80, 0.05)', c2: 'rgba(70, 75, 90, 0.025)' },  // Blue-gray
      { c1: 'rgba(90, 85, 95, 0.04)', c2: 'rgba(80, 75, 85, 0.02)' },  // Purple-gray
      { c1: 'rgba(75, 80, 85, 0.03)', c2: 'rgba(65, 70, 75, 0.015)' },  // Neutral
    ]

    // Light mode colors - subtle, airy
    const lightOrbColors = [
      { c1: 'rgba(150, 155, 170, 0.04)', c2: 'rgba(140, 145, 160, 0.02)' },
      { c1: 'rgba(130, 135, 150, 0.03)', c2: 'rgba(140, 145, 160, 0.015)' },
      { c1: 'rgba(160, 155, 165, 0.025)', c2: 'rgba(150, 145, 155, 0.012)' },
      { c1: 'rgba(145, 150, 155, 0.02)', c2: 'rgba(135, 140, 145, 0.01)' },
    ]

    const orbColors = isDark ? darkOrbColors : lightOrbColors
    const width = window.innerWidth
    const height = window.innerHeight

    // Create flowing orbs
    for (let i = 0; i < 4; i++) {
      const colors = orbColors[i % orbColors.length]
      orbs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 150 + Math.random() * 200,
        color1: colors.c1,
        color2: colors.c2,
        speedX: 0.15 + Math.random() * 0.25,
        speedY: 0.1 + Math.random() * 0.2,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.0008 + Math.random() * 0.0012,
      })
    }

    // Floating particles
    interface Particle {
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      alpha: number
      pulse: number
    }

    const particles: Particle[] = []
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1 + Math.random() * 2,
        speedX: 0.1 + Math.random() * 0.3,
        speedY: 0.05 + Math.random() * 0.15,
        alpha: 0.1 + Math.random() * 0.2,
        pulse: Math.random() * Math.PI * 2,
      })
    }

    let animationFrameId: number
    let time = 0

    const animate = () => {
      const w = window.innerWidth
      const h = window.innerHeight

      // Clear with subtle fade for trail effect
      ctx.clearRect(0, 0, w, h)

      time += 1

      // Draw gradient orbs with flowing movement
      orbs.forEach((orb) => {
        const t = time * 0.001 + orb.phase

        // Smooth sine wave movement
        orb.x += orb.speedX
        orb.y += orb.speedY

        // Wrap around edges
        if (orb.x > w + orb.radius) orb.x = -orb.radius
        if (orb.y > h + orb.radius) orb.y = -orb.radius
        if (orb.x < -orb.radius) orb.x = w + orb.radius
        if (orb.y < -orb.radius) orb.y = h + orb.radius

        // Pulsing radius
        const pulseRadius = orb.radius + Math.sin(t * orb.pulseSpeed * 1000) * 30

        // Create radial gradient
        const gradient = ctx.createRadialGradient(
          orb.x, orb.y, 0,
          orb.x, orb.y, pulseRadius
        )
        gradient.addColorStop(0, orb.color1)
        gradient.addColorStop(0.5, orb.color2)
        gradient.addColorStop(1, 'transparent')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(orb.x, orb.y, pulseRadius, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw floating particles
      particles.forEach((p) => {
        p.x += p.speedX
        p.y += p.speedY
        p.pulse += 0.02

        if (p.x > w) p.x = 0
        if (p.y > h) p.y = 0

        const pulseAlpha = p.alpha + Math.sin(p.pulse) * 0.05
        const pulseSize = p.size + Math.sin(p.pulse) * 0.3

        const particleColor = isDark
          ? `rgba(255, 255, 255, ${pulseAlpha})`
          : `rgba(0, 0, 0, ${pulseAlpha * 0.4})`

        ctx.fillStyle = particleColor
        ctx.beginPath()
        ctx.arc(p.x, p.y, pulseSize, 0, Math.PI * 2)
        ctx.fill()
      })

      // Subtle noise texture overlay (very light)
      if (isDark) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.005)'
        for (let i = 0; i < 50; i++) {
          const x = Math.random() * w
          const y = Math.random() * h
          ctx.fillRect(x, y, 1, 1)
        }
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
    <>
      {/* Base gradient layer */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 30% 20%, rgba(60, 65, 80, 0.05) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(70, 75, 90, 0.04) 0%, transparent 50%)'
            : 'radial-gradient(ellipse at 30% 20%, rgba(140, 145, 160, 0.03) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(130, 135, 150, 0.025) 0%, transparent 50%)',
        }}
      />
      {/* Animated canvas layer */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{
          width: '100%',
          height: '100%',
          opacity: isDark ? 1 : 0.8,
        }}
      />
      {/* Subtle vignette for depth */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.4) 100%)'
            : 'radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.05) 100%)',
        }}
      />
    </>
  )
}

export default function WelcomePage() {
  const { setCurrentWorkspace, setRecentWorkspaces, recentWorkspaces, setCurrentPage } =
    useWorkspaceStore()
  const { setWorkflow, syncEdgeAnimation } = useWorkflowStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [deleteConfirmWorkspace, setDeleteConfirmWorkspace] = useState<{ path: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
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

  const handleAddWorkspace = async () => {
    setIsLoading(true)
    
    try {
      const selectedPath = await window.electronAPI.workspace.open()
      if (!selectedPath) {
        setIsLoading(false)
        return
      }

      const config = await window.electronAPI.workspace.readConfig(selectedPath)
      if (config) {
        await window.electronAPI.recent.add(selectedPath, config.name, config.description)
        setCurrentWorkspace(selectedPath, config)
        
        useExecutionStore.getState().switchWorkspaceContext(selectedPath)

        const workflow = await window.electronAPI.workspace.readWorkflow(selectedPath)
        if (workflow) {
          setWorkflow(workflow as any)

          const executionStore = useExecutionStore.getState()
          const status = executionStore.getExecutionStatusForWorkspace(selectedPath)
          const nodeResults = executionStore.getNodeResultsForWorkspace(selectedPath)
          if (status === 'running' && nodeResults) {
            const runningNodeIds: string[] = []
            nodeResults.forEach((result, nodeId) => {
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

        setCurrentPage('editor')

        const updatedRecentWorkspaces = await window.electronAPI.recent.get()
        setRecentWorkspaces(updatedRecentWorkspaces)
      } else {
        alert('该目录不是有效的 OllamaFlow 项目\n\n请选择包含 .ollamaflow/config.json 的目录，或创建新项目')
      }
    } catch (error) {
      console.error('打开项目失败:', error)
      alert('打开项目失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportFile = async () => {
    if (isImporting) return

    setIsImporting(true)
    try {
      const content = await window.electronAPI.workflow.import()
      if (!content) return

      const importedData = JSON.parse(content)
      const { metadata, nodes, edges, viewport } = importedData

      const baseName = metadata?.name || 'Imported Workflow'
      const defaultPath = await window.electronAPI.workspace.getDefaultProjectsPath()

      let workspaceName = baseName
      let counter = 1
      while (await window.electronAPI.workspace.exists(`${defaultPath}/${workspaceName}`)) {
        workspaceName = `${baseName} (${counter})`
        counter++
      }
      const workspacePath = `${defaultPath}/${workspaceName}`

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
        alert('创建项目失败')
        return
      }

      await window.electronAPI.recent.add(workspacePath, result.config.name, result.config.description)
      setCurrentWorkspace(workspacePath, result.config)
      useExecutionStore.getState().switchWorkspaceContext(workspacePath)
      setWorkflow(result.workflow as any)

      const updatedRecentWorkspaces = await window.electronAPI.recent.get()
      setRecentWorkspaces(updatedRecentWorkspaces)

    } catch (error) {
      console.error('从文件导入失败:', error)
      alert('导入失败：无效的 SubAgent 文件')
    } finally {
      setIsImporting(false)
    }
  }

  const handleOpenRecent = async (path: string) => {
    setIsLoading(true)
    
    try {
      const config = await window.electronAPI.workspace.readConfig(path)
      if (config) {
        await window.electronAPI.recent.add(path, config.name, config.description)
        setCurrentWorkspace(path, config)
        
        useExecutionStore.getState().switchWorkspaceContext(path)

        const workflow = await window.electronAPI.workspace.readWorkflow(path)
        if (workflow) {
          setWorkflow(workflow as any)

          const executionStore = useExecutionStore.getState()
          const status = executionStore.getExecutionStatusForWorkspace(path)
          const nodeResults = executionStore.getNodeResultsForWorkspace(path)
          if (status === 'running' && nodeResults) {
            const runningNodeIds: string[] = []
            nodeResults.forEach((result, nodeId) => {
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

        setCurrentPage('editor')

        const updatedRecentWorkspaces = await window.electronAPI.recent.get()
        setRecentWorkspaces(updatedRecentWorkspaces)
      } else {
        await window.electronAPI.recent.remove(path)
        const updatedRecentWorkspaces = await window.electronAPI.recent.get()
        setRecentWorkspaces(updatedRecentWorkspaces)
        alert('项目不存在或已被删除')
      }
    } catch (error) {
      console.error('打开最近项目失败:', error)
      await window.electronAPI.recent.remove(path)
      const updatedRecentWorkspaces = await window.electronAPI.recent.get()
      setRecentWorkspaces(updatedRecentWorkspaces)
      alert('项目不存在或已被删除')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveRecent = (path: string) => {
    const workspace = recentWorkspaces.find(w => w.path === path)
    if (workspace) {
      setDeleteConfirmWorkspace({ path: workspace.path, name: workspace.name })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirmWorkspace) return

    setIsDeleting(true)
    try {
      const result = await window.electronAPI.workspace.delete(deleteConfirmWorkspace.path)
      if (result.success) {
        await window.electronAPI.recent.remove(deleteConfirmWorkspace.path)
        const updatedRecentWorkspaces = await window.electronAPI.recent.get()
        setRecentWorkspaces(updatedRecentWorkspaces)
      } else {
        alert(`删除项目失败: ${result.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('删除项目失败:', error)
      alert('删除项目失败')
    } finally {
      setIsDeleting(false)
      setDeleteConfirmWorkspace(null)
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirmWorkspace(null)
  }

  // Platform detection for layout adjustments
  const isMac = useMemo(() => {
    return typeof window !== 'undefined' &&
           window.electronAPI?.platform?.isMac?.()
  }, [])

  // Content padding — 顶栏高度 48px + 间距
  const welcomePaddingTop = 'pt-16'

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] overflow-hidden">
      <AnimatedBackground />

      {/* macOS style drag region - only on macOS, positioned to not overlap with toolbar buttons */}
      {isMac && (
        <div
          className="fixed top-0 left-0 w-[72px] h-12 z-30"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
      )}

      {/* Platform-aware toolbar */}
      <AppHeader page="welcome" onGoToAgent={() => setCurrentPage('agent')} />

      {/* Main content area */}
      <div className="relative z-10">
        {/* Welcome section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`max-w-5xl mx-auto px-6 ${welcomePaddingTop} pb-8`}
        >
          <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">
            项目管理
          </h1>
          <p className="text-[var(--color-text-muted)] text-lg">
            管理您的项目和 SubAgent，或创建新的 SubAgent
          </p>
        </motion.div>

        <WorkspaceGrid>
          {recentWorkspaces.map((workspace, index) => (
            <motion.div
              key={workspace.path}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.05 }}
            >
              <WorkspaceCard
                workspace={workspace}
                executionStatus={executionStatuses[workspace.path] || null}
                onOpen={handleOpenRecent}
                onRemove={handleRemoveRecent}
                isLoading={isLoading}
              />
            </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 + recentWorkspaces.length * 0.05 }}
          >
            <AddWorkspaceCard
              onOpenFolder={handleAddWorkspace}
              onImportFile={handleImportFile}
              isLoading={isLoading}
              isImporting={isImporting}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 + recentWorkspaces.length * 0.05 }}
          >
            <NewWorkspaceCard onClick={handleNewProject} isLoading={isLoading} />
          </motion.div>
        </WorkspaceGrid>
      </div>

      {/* Footer - simplified */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="fixed bottom-6 left-0 right-0 text-center z-10"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-floating-subtle">
          <span className="text-[var(--color-text-muted)] text-sm">
            v0.1.0
          </span>
        </div>
      </motion.div>

      <ConfirmDialog
        isOpen={deleteConfirmWorkspace !== null}
        title="删除项目"
        message={`确定要删除项目「${deleteConfirmWorkspace?.name || ''}」吗？\n\n此操作将彻底删除文件夹及其所有内容，且无法恢复。`}
        confirmText={isDeleting ? '删除中...' : '删除'}
        cancelText="取消"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  )
}
