import type { Node, Edge } from '@xyflow/react'
import type { WorkflowNodeData } from '@/types/node'
import { WorkflowExecutor } from './executor'
import { useExecutionStore } from '@/store/execution-store'

interface ExecutionInstance {
  executionId: string
  executor: WorkflowExecutor
  workspacePath: string
  abortController: AbortController
  status: 'running' | 'paused' | 'cancelled'
  promise: Promise<boolean>
}

class ExecutionManager {
  private instances: Map<string, ExecutionInstance> = new Map()

  startExecution(
    workspacePath: string,
    nodes: Node<WorkflowNodeData>[],
    edges: Edge[],
    ollamaHost: string = 'http://127.0.0.1:11434',
    userInputValues?: Record<string, string>
  ): Promise<boolean> {
    if (this.instances.has(workspacePath)) {
      const existing = this.instances.get(workspacePath)!
      if (existing.status === 'running') {
        console.warn(`[ExecutionManager] Workflow already running for workspace: ${workspacePath}`)
        return existing.promise
      }
    }

    // Create execution instance
    const executionStore = useExecutionStore.getState()
    const executionId = executionStore.createExecution(workspacePath, 'workflow')

    const executor = new WorkflowExecutor(
      nodes,
      edges,
      workspacePath,
      executionId,
      ollamaHost,
      userInputValues,
      true
    )

    const abortController = new AbortController()
    const instance: ExecutionInstance = {
      executionId,
      executor,
      workspacePath,
      abortController,
      status: 'running',
      promise: executor.execute(),
    }

    this.instances.set(workspacePath, instance)

    instance.promise.finally(() => {
      if (this.instances.get(workspacePath) === instance) {
        this.instances.delete(workspacePath)
      }
    })

    return instance.promise
  }

  pauseExecution(workspacePath: string): boolean {
    const instance = this.instances.get(workspacePath)
    if (!instance || instance.status !== 'running') {
      return false
    }

    instance.status = 'paused'
    instance.executor.pause()
    return true
  }

  resumeExecution(workspacePath: string): boolean {
    const instance = this.instances.get(workspacePath)
    if (!instance || instance.status !== 'paused') {
      return false
    }

    instance.status = 'running'
    instance.executor.resume()
    return true
  }

  cancelExecution(workspacePath: string): boolean {
    const instance = this.instances.get(workspacePath)
    if (!instance) {
      return false
    }

    instance.status = 'cancelled'
    instance.abortController.abort()
    instance.executor.abort()

    // Update execution store status
    const executionStore = useExecutionStore.getState()
    executionStore.cancelExecutionForWorkspace(workspacePath)

    return true
  }

  getExecutionStatus(workspacePath: string): 'idle' | 'running' | 'paused' | 'cancelled' | null {
    const instance = this.instances.get(workspacePath)
    if (!instance) {
      return null
    }
    return instance.status
  }

  isExecuting(workspacePath: string): boolean {
    const instance = this.instances.get(workspacePath)
    return instance?.status === 'running' || instance?.status === 'paused'
  }

  getAllExecutingWorkspaces(): string[] {
    return Array.from(this.instances.keys())
  }
}

export const executionManager = new ExecutionManager()
