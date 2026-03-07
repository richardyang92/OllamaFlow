import { useCallback, useState, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useExecutionStore } from '@/store/execution-store'
import { useResolvedTheme } from '@/contexts/ThemeContext'
import { PanelProvider, usePanelContext } from '@/contexts/PanelContext'
import FlowCanvas from '@/components/workflow/FlowCanvas'
import { FloatingToolbar } from '@/components/workflow/FloatingToolbar'
import { FloatingIconBar } from '@/components/workflow/FloatingIconBar'
import { FloatingSidebar } from '@/components/workflow/FloatingSidebar'
import { type FileItem } from '@/components/workflow/WorkspaceFiles'
import ExecutionPanel from '@/components/workflow/ExecutionPanel'
import InputDialog from '@/components/workflow/InputDialog'
import FilePreviewDialog from '@/components/workflow/FilePreviewDialog'
import { initializeExecutors } from '@/engine/executor'
import { executionManager } from '@/engine/execution-manager'
import type { RecentWorkspace } from '@/types/workspace'

function EditFeedback({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg glass-floating text-green-400 text-sm font-medium shadow-lg flex items-center gap-2"
    >
      <Check className="w-4 h-4" />
      {message}
    </motion.div>
  )
}

initializeExecutors()

function EditorContent() {
  const { currentWorkspace, clearCurrentWorkspace, setCurrentPage, updateConfig, addRecentWorkspace } = useWorkspaceStore()
  const { workflow, isDirty, markClean, syncEdgeAnimation } = useWorkflowStore()
  const resolvedTheme = useResolvedTheme()
  const {
    executionPanelVisible,
    toggleExecutionPanel,
    isPanelManuallyClosed,
    setActivePanel
  } = usePanelContext()

  // Subscribe to execution store changes - use workspace-specific status
  const workspacePath = currentWorkspace?.path

  // Get current workspace execution status
  const executionStatus = useExecutionStore((state) => {
    if (!workspacePath) return 'idle' as const
    return state.getExecutionStatusForWorkspace(workspacePath)
  })

  // Sync edge animations based on running nodes
  const nodeResults = useExecutionStore((state) => {
    if (!workspacePath) return undefined
    return state.getNodeResultsForWorkspace(workspacePath)
  })

  useEffect(() => {
    if (!nodeResults) return

    const runningNodeIds: string[] = []
    nodeResults.forEach((result, nodeId) => {
      if (result.status === 'running') {
        runningNodeIds.push(nodeId)
      }
    })

    syncEdgeAnimation(runningNodeIds)
  }, [nodeResults, syncEdgeAnimation])

  const [showInputDialog, setShowInputDialog] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)
  const [saveActive, setSaveActive] = useState(false)

  const handleNodeClick = useCallback(() => {
    // Always open properties panel when clicking a node
    setActivePanel('properties')
  }, [setActivePanel])

  const handlePaneClick = useCallback(() => {
    // Close properties panel when clicking on empty canvas
    setActivePanel(null)
  }, [setActivePanel])

  const handleSave = useCallback(async () => {
    if (!currentWorkspace || !workflow || saveActive) return

    setSaveActive(true)
    const startTime = Date.now()
    try {
      const { nodes, edges } = useWorkflowStore.getState()

      const serializedNodes = nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        parentId: node.parentId,
        extent: node.extent,
        expandParent: node.expandParent,
        width: node.width,
        height: node.height,
        data: node.data
      }))

      const serializedEdges = edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
        animated: edge.animated,
        style: edge.style,
        data: edge.data
      }))

      const updatedWorkflow = {
        ...workflow,
        metadata: {
          ...workflow.metadata,
          updatedAt: new Date().toISOString(),
        },
        nodes: serializedNodes,
        edges: serializedEdges,
      }

      const success = await window.electronAPI.workspace.saveWorkflow(
        currentWorkspace.path,
        updatedWorkflow
      )

      if (success) {
        useWorkflowStore.getState().setWorkflow(updatedWorkflow)
        const executionId = useExecutionStore.getState().getActiveExecution(currentWorkspace.path)
        if (executionId) {
          useExecutionStore.getState().addLog(executionId, {
            level: 'info',
            message: '工作流保存成功',
          })
        }
        setSaveFeedback('工作流保存成功')
        setTimeout(() => setSaveFeedback(null), 2000)
        markClean()
        const elapsed = Date.now() - startTime
        const minDisplayTime = 300
        if (elapsed < minDisplayTime) {
          setTimeout(() => setSaveActive(false), minDisplayTime - elapsed)
        } else {
          setSaveActive(false)
        }
      } else {
        throw new Error('保存返回失败')
      }
    } catch (error) {
      console.error('保存工作流失败:', error)
      const executionId = useExecutionStore.getState().getActiveExecution(currentWorkspace.path)
      if (executionId) {
        useExecutionStore.getState().addLog(executionId, {
          level: 'error',
          message: `保存工作流失败: ${error instanceof Error ? error.message : String(error)}`,
        })
      }
      setSaveActive(false)
    }
  }, [currentWorkspace, workflow, markClean, saveActive])

  const handleClose = useCallback(() => {
    console.log('[Editor] handleClose', { isDirty, executionStatus })
    if (isDirty) {
      const confirm = window.confirm('您有未保存的更改。确定要关闭吗？')
      if (!confirm) return
    }
    if (executionStatus !== 'running' && currentWorkspace) {
      console.log('[Editor] handleClose - calling resetWorkspaceExecution')
      useExecutionStore.getState().resetWorkspaceExecution(currentWorkspace.path)
    }
    clearCurrentWorkspace()
    useWorkflowStore.getState().clearWorkflow()
    setCurrentPage('welcome')
  }, [isDirty, clearCurrentWorkspace, executionStatus, setCurrentPage, currentWorkspace])

  const handleExecute = useCallback(async () => {
    if (executionStatus === 'running') {
      if (currentWorkspace) {
        executionManager.cancelExecution(currentWorkspace.path)
        useExecutionStore.getState().cancelExecutionForWorkspace(currentWorkspace.path)
        // Sync cancellation status to main process for Welcome page
        await window.electronAPI.execution.cancel(currentWorkspace.path)
      }
    } else {
      if (!currentWorkspace) return

      const { nodes } = useWorkflowStore.getState()

      if (nodes.length === 0) {
        const executionId = useExecutionStore.getState().getActiveExecution(currentWorkspace.path)
        if (executionId) {
          useExecutionStore.getState().addLog(executionId, {
            level: 'warn',
            message: '没有可执行的节点。请先添加节点到工作流。',
          })
        }
        return
      }

      const inputNodes = nodes.filter(n => n.data.nodeType === 'input')
      const needsInput = inputNodes.some(n => {
        const data = n.data as { defaultValue?: string }
        return !data.defaultValue || data.defaultValue.trim() === ''
      })

      if (inputNodes.length > 0 && needsInput) {
        setShowInputDialog(true)
        return
      }

      const { nodes: workflowNodes, edges: workflowEdges } = useWorkflowStore.getState()
      executeWorkflow(workflowNodes, workflowEdges)
    }
  }, [executionStatus, currentWorkspace])

  const executeWorkflow = useCallback((nodes: any[], edges: any[], inputValues?: Record<string, string>) => {
    if (!currentWorkspace) return

    // Smart context: auto-open execution panel if not manually closed
    if (!isPanelManuallyClosed('execution')) {
      toggleExecutionPanel()
    }

    executionManager.startExecution(
      currentWorkspace.path,
      nodes,
      edges,
      currentWorkspace.config.ollamaHost,
      inputValues || undefined
    ).catch((error: Error) => {
      const executionId = useExecutionStore.getState().getActiveExecution(currentWorkspace.path)
      if (executionId) {
        useExecutionStore.getState().addLog(executionId, {
          level: 'error',
          message: `执行错误: ${error.message}`,
        })
      }
    })
  }, [currentWorkspace, isPanelManuallyClosed, toggleExecutionPanel])

  const handleInputSubmit = useCallback((values: Record<string, string>) => {
    setShowInputDialog(false)

    const { nodes, edges } = useWorkflowStore.getState()
    executeWorkflow(nodes, edges, values)
  }, [executeWorkflow])

  const handleInputCancel = useCallback(() => {
    setShowInputDialog(false)
  }, [])

  const handleDragStart = useCallback(() => {
    // Smart context: auto-open nodes panel
    if (!isPanelManuallyClosed('nodes')) {
      setActivePanel('nodes')
    }
  }, [isPanelManuallyClosed, setActivePanel])

  // Export workflow
  const handleExport = useCallback(async () => {
    if (!workflow) return

    const { nodes, edges } = useWorkflowStore.getState()
    const exportData = {
      metadata: workflow.metadata,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        parentId: node.parentId,
        extent: node.extent,
        expandParent: node.expandParent,
        width: node.width,
        height: node.height,
        data: node.data
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
        animated: edge.animated,
        style: edge.style,
        data: edge.data
      })),
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    const filePath = await window.electronAPI.workflow.export(JSON.stringify(exportData, null, 2))
    if (filePath) {
      setSaveFeedback('工作流导出成功')
      setTimeout(() => setSaveFeedback(null), 2000)
    }
  }, [workflow])

  // Import workflow
  const handleImport = useCallback(async () => {
    const content = await window.electronAPI.workflow.import()
    if (!content) return

    try {
      const importedData = JSON.parse(content)
      const { nodes, edges, metadata } = importedData

      // Update workflow with imported data
      if (currentWorkspace && workflow) {
        const updatedWorkflow = {
          ...workflow,
          metadata: {
            ...workflow.metadata,
            ...metadata,
            updatedAt: new Date().toISOString(),
          },
          nodes,
          edges,
        }
        useWorkflowStore.getState().setWorkflow(updatedWorkflow)
        setSaveFeedback('工作流导入成功')
        setTimeout(() => setSaveFeedback(null), 2000)
      }
    } catch (error) {
      console.error('导入工作流失败:', error)
      setSaveFeedback('导入失败：无效的工作流文件')
      setTimeout(() => setSaveFeedback(null), 2000)
    }
  }, [currentWorkspace, workflow])

  // Edit workspace info
  const handleEditInfo = useCallback(async (name: string, description: string) => {
    if (!currentWorkspace) return

    const oldName = currentWorkspace.config.name
    const oldPath = currentWorkspace.path

    try {
      // If name changed, rename the workspace directory
      if (name !== oldName) {
        const result = await window.electronAPI.workspace.rename(oldPath, name)

        if (!result.success) {
          setSaveFeedback(result.error || '重命名失败')
          setTimeout(() => setSaveFeedback(null), 2000)
          return
        }

        // Update workspace store with new path and config
        useWorkspaceStore.getState().setCurrentWorkspace(result.newPath!, result.config!)

        // Update description if changed
        if (description !== currentWorkspace.config.description) {
          await window.electronAPI.workspace.updateConfig(result.newPath!, { description })
          updateConfig({ description })
        }

        // Update recent workspaces list with new path
        addRecentWorkspace({
          path: result.newPath!,
          name,
          description,
          lastOpened: new Date().toISOString(),
        } as RecentWorkspace)
      } else {
        // Only update description
        const updatedConfig = await window.electronAPI.workspace.updateConfig(
          oldPath,
          { description }
        )

        if (updatedConfig) {
          updateConfig({ description })

          // Update recent workspaces list
          addRecentWorkspace({
            path: oldPath,
            name,
            description,
            lastOpened: new Date().toISOString(),
          } as RecentWorkspace)
        }
      }

      setSaveFeedback('工作流信息已更新')
      setTimeout(() => setSaveFeedback(null), 2000)
    } catch (error) {
      console.error('更新工作流信息失败:', error)
      setSaveFeedback('更新失败')
      setTimeout(() => setSaveFeedback(null), 2000)
    }
  }, [currentWorkspace, updateConfig, addRecentWorkspace])

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-canvas)] text-[var(--color-text)] overflow-hidden">
      <FloatingToolbar
        workspaceName={currentWorkspace?.config.name || '未命名'}
        workspaceDescription={currentWorkspace?.config.description || ''}
        isDirty={isDirty}
        executionStatus={executionStatus}
        saveActive={saveActive}
        onSave={handleSave}
        onClose={handleClose}
        onExecute={handleExecute}
        onExport={handleExport}
        onImport={handleImport}
        onEditInfo={handleEditInfo}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden relative">
          <FlowCanvas
            colorMode={resolvedTheme}
            onDragStart={handleDragStart}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
          />

          <AnimatePresence>
            {executionPanelVisible && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-4 left-4 right-4 z-30 h-64 glass-panel rounded-glass-lg"
              >
                <ExecutionPanel onClose={() => toggleExecutionPanel()} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating panel system */}
      <FloatingIconBar />
      <FloatingSidebar onFileClick={(file) => setSelectedFile(file)} />

      {showInputDialog && (
        <InputDialog
          nodes={useWorkflowStore.getState().nodes}
          onSubmit={handleInputSubmit}
          onCancel={handleInputCancel}
        />
      )}

      {selectedFile && (
        <FilePreviewDialog
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}

      <AnimatePresence>
        {saveFeedback && <EditFeedback message={saveFeedback} />}
      </AnimatePresence>
    </div>
  )
}

export default function EditorPage() {
  return (
    <ReactFlowProvider>
      <PanelProvider>
        <EditorContent />
      </PanelProvider>
    </ReactFlowProvider>
  )
}
