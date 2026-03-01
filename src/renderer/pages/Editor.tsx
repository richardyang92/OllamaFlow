import { useCallback, useState, useRef, useMemo } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useExecutionStore } from '@/store/execution-store'
import { useResolvedTheme } from '@/contexts/ThemeContext'
import FlowCanvas from '@/components/workflow/FlowCanvas'
import { FloatingToolbar } from '@/components/workflow/FloatingToolbar'
import NodePalette from '@/components/workflow/NodePalette'
import PropertiesPanel from '@/components/workflow/PropertiesPanel'
import WorkspaceFiles, { type FileItem } from '@/components/workflow/WorkspaceFiles'
import ExecutionPanel from '@/components/workflow/ExecutionPanel'
import InputDialog from '@/components/workflow/InputDialog'
import FilePreviewDialog from '@/components/workflow/FilePreviewDialog'
import { CollapsibleDrawer } from '@/components/ui/CollapsibleDrawer'
import { initializeExecutors } from '@/engine/executor'
import { executionManager } from '@/engine/execution-manager'

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

export default function EditorPage() {
  const { currentWorkspace, clearCurrentWorkspace, setCurrentPage } = useWorkspaceStore()
  const { workflow, isDirty, markClean } = useWorkflowStore()
  const resolvedTheme = useResolvedTheme()
  
  // Subscribe to execution store changes - use workspace-specific status
  const workspacePath = currentWorkspace?.path
  const workspaces = useExecutionStore((state) => state.workspaces)
  const globalStatus = useExecutionStore((state) => state.status)
  const cancelExecution = useExecutionStore((state) => state.cancelExecution)
  
  // Get current workspace execution status
  const executionStatus = useMemo(() => {
    if (!workspacePath) return globalStatus
    const workspaceState = workspaces.get(workspacePath)
    return workspaceState?.status || globalStatus
  }, [workspacePath, workspaces, globalStatus])
  
  const [showFiles, setShowFiles] = useState(false)
  const [showProperties, setShowProperties] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [showInputDialog, setShowInputDialog] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)
  const [saveActive, setSaveActive] = useState(false)
  const userClosedPropertiesRef = useRef(false)

  const handlePropertiesClose = useCallback(() => {
    userClosedPropertiesRef.current = true
    setShowProperties(false)
  }, [])

  const handleNodeClick = useCallback(() => {
    userClosedPropertiesRef.current = false
    setShowProperties(true)
  }, [])

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
        useExecutionStore.getState().addLog({
          level: 'info',
          message: '工作流保存成功',
        })
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
      useExecutionStore.getState().addLog({
        level: 'error',
        message: `保存工作流失败: ${error instanceof Error ? error.message : String(error)}`,
      })
      setSaveActive(false)
    }
  }, [currentWorkspace, workflow, markClean, saveActive])

  const handleClose = useCallback(() => {
    console.log('[Editor] handleClose', { isDirty, executionStatus })
    if (isDirty) {
      const confirm = window.confirm('您有未保存的更改。确定要关闭吗？')
      if (!confirm) return
    }
    if (executionStatus !== 'running') {
      console.log('[Editor] handleClose - calling resetExecution')
      useExecutionStore.getState().resetExecution()
    }
    clearCurrentWorkspace()
    useWorkflowStore.getState().clearWorkflow()
    setCurrentPage('welcome')
  }, [isDirty, clearCurrentWorkspace, executionStatus, setCurrentPage])

  const handleExecute = useCallback(async () => {
    if (executionStatus === 'running') {
      if (currentWorkspace) {
        executionManager.cancelExecution(currentWorkspace.path)
      }
      cancelExecution()
    } else {
      if (!currentWorkspace) return

      const { nodes } = useWorkflowStore.getState()

      if (nodes.length === 0) {
        useExecutionStore.getState().addLog({
          level: 'warn',
          message: '没有可执行的节点。请先添加节点到工作流。',
        })
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
  }, [executionStatus, currentWorkspace, cancelExecution])

  const executeWorkflow = useCallback((nodes: any[], edges: any[], inputValues?: Record<string, string>) => {
    if (!currentWorkspace) return

    executionManager.startExecution(
      currentWorkspace.path,
      nodes,
      edges,
      currentWorkspace.config.ollamaHost,
      inputValues || undefined
    ).catch((error: Error) => {
      useExecutionStore.getState().addLog({
        level: 'error',
        message: `执行错误: ${error.message}`,
      })
    })
  }, [currentWorkspace])

  const handleInputSubmit = useCallback((values: Record<string, string>) => {
    setShowInputDialog(false)

    const { nodes, edges } = useWorkflowStore.getState()
    executeWorkflow(nodes, edges, values)
  }, [executeWorkflow])

  const handleInputCancel = useCallback(() => {
    setShowInputDialog(false)
  }, [])

  const handleDragStart = useCallback(() => {
    setShowPalette(true)
  }, [])

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col bg-[var(--color-bg-canvas)] text-[var(--color-text)] overflow-hidden">
        <FloatingToolbar
          workspaceName={currentWorkspace?.config.name || '未命名'}
          isDirty={isDirty}
          executionStatus={executionStatus}
          showPalette={showPalette}
          showLogs={showLogs}
          saveActive={saveActive}
          onSave={handleSave}
          onClose={handleClose}
          onExecute={handleExecute}
          onToggleLogs={() => {
            if (!showLogs) {
              setShowFiles(true)
            }
            setShowLogs(!showLogs)
          }}
          onTogglePalette={() => setShowPalette(!showPalette)}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden relative">
            <FlowCanvas 
              colorMode={resolvedTheme}
              onDragStart={handleDragStart}
              onNodeClick={handleNodeClick}
            />
            
            <AnimatePresence>
              {showLogs && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-4 left-4 right-4 z-30 h-64 glass-panel rounded-glass-lg"
                >
                  <div className="flex h-full">
                    {showFiles && (
                      <div className="w-56 shrink-0 pr-2 border-r border-[var(--color-border-subtle)]">
                        <WorkspaceFiles 
                          onClose={() => setShowFiles(false)} 
                          onFileClick={(file) => setSelectedFile(file)}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <ExecutionPanel 
                        onClose={() => setShowLogs(false)} 
                        onToggleFiles={() => setShowFiles(!showFiles)} 
                        showFiles={showFiles} 
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <CollapsibleDrawer
          side="left"
          isOpen={showPalette}
          onClose={() => setShowPalette(false)}
          width={280}
          minWidth={240}
          maxWidth={400}
        >
          <NodePalette 
            onClose={() => setShowPalette(false)} 
            isDrawer
          />
        </CollapsibleDrawer>

        <CollapsibleDrawer
          side="right"
          isOpen={showProperties}
          onClose={handlePropertiesClose}
          width={320}
          minWidth={280}
          maxWidth={480}
        >
          <PropertiesPanel 
            onClose={handlePropertiesClose} 
            isDrawer
          />
        </CollapsibleDrawer>
      </div>

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
    </ReactFlowProvider>
  )
}
