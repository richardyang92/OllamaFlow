import { useCallback, useState, useRef, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useExecutionStore } from '@/store/execution-store'
import FlowCanvas from '@/components/workflow/FlowCanvas'
import Toolbar from '@/components/workflow/Toolbar'
import NodePalette from '@/components/workflow/NodePalette'
import PropertiesPanel from '@/components/workflow/PropertiesPanel'
import WorkspaceFiles from '@/components/workflow/WorkspaceFiles'
import ExecutionPanel from '@/components/workflow/ExecutionPanel'
import InputDialog from '@/components/workflow/InputDialog'
import { WorkflowExecutor, initializeExecutors } from '@/engine/executor'

// Toast notification component
function EditFeedback({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg bg-green-500/20 backdrop-blur-md border border-green-500/30 text-green-400 text-sm font-medium shadow-lg"
    >
      ✓ {message}
    </motion.div>
  )
}

// Initialize executors once
initializeExecutors()

export default function EditorPage() {
  const { currentWorkspace, clearCurrentWorkspace } = useWorkspaceStore()
  const { workflow, isDirty, markClean, selectedNodeId } = useWorkflowStore()
  const { status: executionStatus, cancelExecution } = useExecutionStore()
  const [showFiles, setShowFiles] = useState(false)
  const [showProperties, setShowProperties] = useState(true)
  const [showPalette, setShowPalette] = useState(true)
  const [showLogs, setShowLogs] = useState(true)
  const [showInputDialog, setShowInputDialog] = useState(false)
  const [pendingInputValues, setPendingInputValues] = useState<Record<string, string> | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)
  const executorRef = useRef<WorkflowExecutor | null>(null)
  const previousSelectedNodeId = useRef<string | null>(null)

  // Auto-open properties panel when a different node is selected
  useEffect(() => {
    // Only open panel if a different node is selected (not the same one)
    if (selectedNodeId && selectedNodeId !== previousSelectedNodeId.current && !showProperties) {
      setShowProperties(true)
    }
    // Update previous selected node ID
    previousSelectedNodeId.current = selectedNodeId
  }, [selectedNodeId, showProperties])

  const handleSave = useCallback(async () => {
    if (!currentWorkspace || !workflow) return

    try {
      // 获取当前节点和边
      const { nodes, edges } = useWorkflowStore.getState()
      
      // 序列化节点和边，只保留可序列化的属性
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
        // 更新 workflow 状态，确保状态与保存的文件一致
        useWorkflowStore.getState().setWorkflow(updatedWorkflow)
        markClean()
        useExecutionStore.getState().addLog({
          level: 'info',
          message: '工作流保存成功',
        })
        // 显示保存成功的 toast 提示
        setSaveFeedback('工作流保存成功')
        setTimeout(() => setSaveFeedback(null), 2000)
      } else {
        throw new Error('保存返回失败')
      }
    } catch (error) {
      console.error('保存工作流失败:', error)
      useExecutionStore.getState().addLog({
        level: 'error',
        message: `保存工作流失败: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }, [currentWorkspace, workflow, markClean])

  const handleClose = useCallback(() => {
    if (isDirty) {
      const confirm = window.confirm('您有未保存的更改。确定要关闭吗？')
      if (!confirm) return
    }
    clearCurrentWorkspace()
    useWorkflowStore.getState().clearWorkflow()
  }, [isDirty, clearCurrentWorkspace])

  const handleExecute = useCallback(async () => {
    if (executionStatus === 'running') {
      // Stop execution
      if (executorRef.current) {
        executorRef.current.abort()
      }
      cancelExecution()
      executorRef.current = null
    } else {
      // Start execution
      if (!currentWorkspace) return

      const { nodes, edges } = useWorkflowStore.getState()

      if (nodes.length === 0) {
        useExecutionStore.getState().addLog({
          level: 'warn',
          message: '没有可执行的节点。请先添加节点到工作流。',
        })
        return
      }

      // Check if there are input nodes with empty default values
      const inputNodes = nodes.filter(n => n.data.nodeType === 'input')
      const needsInput = inputNodes.some(n => {
        const data = n.data as { defaultValue?: string }
        return !data.defaultValue || data.defaultValue.trim() === ''
      })

      if (inputNodes.length > 0 && needsInput) {
        // Show input dialog
        setShowInputDialog(true)
        return
      }

      // Execute directly with default values
      const { nodes: workflowNodes, edges: workflowEdges } = useWorkflowStore.getState()
      executeWorkflow(workflowNodes, workflowEdges)
    }
  }, [executionStatus, currentWorkspace, cancelExecution])

  const executeWorkflow = useCallback((nodes: any[], edges: any[], inputValues?: Record<string, string>) => {
    if (!currentWorkspace) return

    const executor = new WorkflowExecutor(
      nodes,
      edges,
      currentWorkspace.path,
      currentWorkspace.config.ollamaHost,
      inputValues || undefined
    )

    executorRef.current = executor

    // Run execution asynchronously
    executor.execute().catch((error) => {
      useExecutionStore.getState().addLog({
        level: 'error',
        message: `执行错误: ${error instanceof Error ? error.message : String(error)}`,
      })
    })

    // Reset pending input values
    setPendingInputValues(null)
  }, [currentWorkspace])

  const handleInputSubmit = useCallback((values: Record<string, string>) => {
    setShowInputDialog(false)

    const { nodes, edges } = useWorkflowStore.getState()
    executeWorkflow(nodes, edges, values)
  }, [executeWorkflow])

  const handleInputCancel = useCallback(() => {
    setShowInputDialog(false)
    setPendingInputValues(null)
  }, [])

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col bg-[#0d0d0d] text-white">
        {/* Toolbar with enhanced visual weight */}
        <Toolbar
          workspaceName={currentWorkspace?.config.name || '未命名'}
          isDirty={isDirty}
          executionStatus={executionStatus}
          onSave={handleSave}
          onClose={handleClose}
          onExecute={handleExecute}
          onToggleLogs={() => setShowLogs(!showLogs)}
        />

        {/* Main Content - Vertical flex layout */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Upper section - Canvas and panels */}
          <div className="flex-1 flex overflow-hidden transition-all duration-300">
            {/* Left Panel - Node Palette with unified styling */}
            {showPalette && <NodePalette onClose={() => setShowPalette(false)} />}

            {/* Toggle button for NodePalette when hidden */}
            {!showPalette && (
              <button
                onClick={() => setShowPalette(true)}
                className="absolute left-6 top-20 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 transition-colors z-10"
                title="显示节点面板"
              >
                ◀ 节点
              </button>
            )}

            {/* Center - Canvas */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <FlowCanvas />
            </div>

            {/* Right Panel - Properties */}
            {showProperties && <PropertiesPanel onClose={() => setShowProperties(false)} />}

            {/* Toggle button for PropertiesPanel when hidden */}
            {!showProperties && (
              <button
                onClick={() => setShowProperties(true)}
                className="absolute right-6 top-20 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 transition-colors z-10"
                title="显示属性面板"
              >
                属性 ▶
              </button>
            )}
          </div>

          {/* Bottom Panel - Logs */}
          {showLogs && (
            <div className="h-64 flex pb-4 pl-4 pr-4 bg-[#0d0d0d]/95 backdrop-blur-md rounded-xl">
              {/* Workspace Files */}
              {showFiles && (
                <div className="w-64 transition-all duration-300 pr-2">
                  <WorkspaceFiles onClose={() => setShowFiles(false)} />
                </div>
              )}

              {/* Execution Logs */}
              <div className="flex-1">
                <ExecutionPanel onClose={() => setShowLogs(false)} onToggleFiles={() => setShowFiles(!showFiles)} showFiles={showFiles} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Dialog */}
      {showInputDialog && (
        <InputDialog
          nodes={useWorkflowStore.getState().nodes}
          onSubmit={handleInputSubmit}
          onCancel={handleInputCancel}
        />
      )}

      {/* Save feedback toast */}
      <AnimatePresence>
        {saveFeedback && <EditFeedback message={saveFeedback} />}
      </AnimatePresence>
    </ReactFlowProvider>
  )
}
