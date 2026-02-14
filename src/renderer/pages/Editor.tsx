import { useCallback, useState, useRef } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useExecutionStore } from '@/store/execution-store'
import FlowCanvas from '@/components/workflow/FlowCanvas'
import Toolbar from '@/components/workflow/Toolbar'
import NodePalette from '@/components/workflow/NodePalette'
import PropertiesPanel from '@/components/workflow/PropertiesPanel'
import WorkspaceFiles from '@/components/workflow/WorkspaceFiles'
import ExecutionPanel from '@/components/workflow/ExecutionPanel'
import { WorkflowExecutor, initializeExecutors } from '@/engine/executor'

// Initialize executors once
initializeExecutors()

export default function EditorPage() {
  const { currentWorkspace, clearCurrentWorkspace } = useWorkspaceStore()
  const { workflow, isDirty, markClean } = useWorkflowStore()
  const { status: executionStatus, cancelExecution } = useExecutionStore()
  const [showFiles, setShowFiles] = useState(true)
  const [showProperties, setShowProperties] = useState(true)
  const executorRef = useRef<WorkflowExecutor | null>(null)

  const handleSave = useCallback(async () => {
    if (!currentWorkspace || !workflow) return

    const updatedWorkflow = {
      ...workflow,
      metadata: {
        ...workflow.metadata,
        updatedAt: new Date().toISOString(),
      },
      nodes: useWorkflowStore.getState().nodes,
      edges: useWorkflowStore.getState().edges,
    }

    await window.electronAPI.workspace.saveWorkflow(
      currentWorkspace.path,
      updatedWorkflow
    )
    markClean()
  }, [currentWorkspace, workflow, markClean])

  const handleClose = useCallback(() => {
    if (isDirty) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to close?')
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
          message: 'No nodes to execute. Add some nodes to the workflow.',
        })
        return
      }

      const executor = new WorkflowExecutor(
        nodes,
        edges,
        currentWorkspace.path,
        currentWorkspace.config.ollamaHost
      )

      executorRef.current = executor

      // Run execution asynchronously
      executor.execute().catch((error) => {
        useExecutionStore.getState().addLog({
          level: 'error',
          message: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
        })
      })
    }
  }, [executionStatus, currentWorkspace, cancelExecution])

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col bg-gray-900 text-white">
        {/* Toolbar */}
        <Toolbar
          workspaceName={currentWorkspace?.config.name || 'Untitled'}
          isDirty={isDirty}
          executionStatus={executionStatus}
          onSave={handleSave}
          onClose={handleClose}
          onExecute={handleExecute}
        />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Node Palette */}
          <NodePalette />

          {/* Center - Canvas */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <FlowCanvas />
          </div>

          {/* Right Panel - Properties */}
          {showProperties && <PropertiesPanel onClose={() => setShowProperties(false)} />}
        </div>

        {/* Bottom Panel */}
        <div className="h-48 flex border-t border-gray-700">
          {/* Workspace Files */}
          {showFiles && (
            <div className="w-80 border-r border-gray-700">
              <WorkspaceFiles onToggle={() => setShowFiles(!showFiles)} />
            </div>
          )}

          {/* Execution Logs */}
          <div className="flex-1">
            <ExecutionPanel onToggleFiles={() => setShowFiles(!showFiles)} showFiles={showFiles} />
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  )
}
