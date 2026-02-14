import type { Node, Edge } from '@xyflow/react'
import type { WorkflowNodeData, NodeType } from '@/types/node'
import type { NodeExecutionResult, ExecutionLog } from '@/types/execution'
import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'

// Expression evaluation - replaces {{variable}} patterns
export function interpolateVariables(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmedKey = key.trim()
    const value = getNestedValue(context, trimmedKey)
    return value !== undefined ? String(value) : ''
  })
}

// Get nested value from object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return current
}

// Build execution context from previous node results
function buildInputContext(
  nodeId: string,
  edges: Edge[],
  nodeResults: Map<string, NodeExecutionResult>
): Record<string, unknown> {
  const context: Record<string, unknown> = {}

  // Find all incoming edges
  const incomingEdges = edges.filter((edge) => edge.target === nodeId)

  for (const edge of incomingEdges) {
    const sourceResult = nodeResults.get(edge.source)
    if (sourceResult?.output) {
      // Map the output to the input port
      const sourceHandle = edge.sourceHandle || 'output'
      const targetHandle = edge.targetHandle || 'input'

      if (typeof sourceResult.output === 'object' && sourceResult.output !== null) {
        const outputObj = sourceResult.output as Record<string, unknown>
        if (sourceHandle in outputObj) {
          context[targetHandle] = outputObj[sourceHandle]
        } else {
          context[targetHandle] = sourceResult.output
        }
      } else {
        context[targetHandle] = sourceResult.output
      }
    }
  }

  return context
}

// Get execution order using topological sort
export function getExecutionOrder(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[]
): string[] {
  const order: string[] = []
  const visited = new Set<string>()

  // Build adjacency list
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const node of nodes) {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  for (const edge of edges) {
    const targets = adjacency.get(edge.source) || []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  }

  // Find start nodes (nodes with no incoming edges, or trigger nodes)
  const queue: string[] = []

  for (const node of nodes) {
    const degree = inDegree.get(node.id) || 0
    if (degree === 0 || node.data.nodeType === 'manualTrigger') {
      queue.push(node.id)
    }
  }

  // BFS traversal
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (visited.has(nodeId)) continue

    order.push(nodeId)
    visited.add(nodeId)

    const neighbors = adjacency.get(nodeId) || []
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0 && !visited.has(neighbor)) {
        queue.push(neighbor)
      }
    }
  }

  return order
}

// Node executor interface
export interface NodeExecutor {
  execute(
    node: Node<WorkflowNodeData>,
    input: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<unknown>
}

// Execution context passed to node executors
export interface ExecutionContext {
  workspacePath: string
  ollamaHost: string
  variables: Record<string, unknown>
  onStream?: (nodeId: string, chunk: string) => void
  onLog?: (log: Omit<ExecutionLog, 'id' | 'timestamp' | 'executionId'>) => void
}

// Import node executors
import { createManualTriggerExecutor } from './nodes/manual-trigger'
import { createInputExecutor } from './nodes/input'
import { createOllamaChatExecutor } from './nodes/ollama-chat'
import { createSetExecutor } from './nodes/set'
import { createIfExecutor } from './nodes/if'
import { createOutputExecutor } from './nodes/output'
import { createReadFileExecutor } from './nodes/read-file'
import { createWriteFileExecutor } from './nodes/write-file'
import { createExecuteCommandExecutor } from './nodes/execute-command'

// Node executor registry
const nodeExecutors: Partial<Record<NodeType, NodeExecutor>> = {}

// Register all node executors
export function registerNodeExecutor(type: NodeType, executor: NodeExecutor) {
  nodeExecutors[type] = executor
}

// Initialize executors
export function initializeExecutors() {
  registerNodeExecutor('manualTrigger', createManualTriggerExecutor())
  registerNodeExecutor('input', createInputExecutor())
  registerNodeExecutor('ollamaChat', createOllamaChatExecutor())
  registerNodeExecutor('set', createSetExecutor())
  registerNodeExecutor('if', createIfExecutor())
  registerNodeExecutor('output', createOutputExecutor())
  registerNodeExecutor('readFile', createReadFileExecutor())
  registerNodeExecutor('writeFile', createWriteFileExecutor())
  registerNodeExecutor('executeCommand', createExecuteCommandExecutor())
}

// Main workflow executor
export class WorkflowExecutor {
  private nodes: Node<WorkflowNodeData>[]
  private edges: Edge[]
  private workspacePath: string
  private ollamaHost: string
  private abortController: AbortController | null = null

  constructor(
    nodes: Node<WorkflowNodeData>[],
    edges: Edge[],
    workspacePath: string,
    ollamaHost: string = 'http://127.0.0.1:11434'
  ) {
    this.nodes = nodes
    this.edges = edges
    this.workspacePath = workspacePath
    this.ollamaHost = ollamaHost
  }

  async execute(): Promise<boolean> {
    const executionStore = useExecutionStore.getState()

    // Initialize executors if not done
    if (Object.keys(nodeExecutors).length === 0) {
      initializeExecutors()
    }

    // Start execution
    executionStore.startExecution('workflow')

    // Get execution order
    const executionOrder = getExecutionOrder(this.nodes, this.edges)

    this.abortController = new AbortController()
    const variables: Record<string, unknown> = {}

    const context: ExecutionContext = {
      workspacePath: this.workspacePath,
      ollamaHost: this.ollamaHost,
      variables,
      onStream: (nodeId, chunk) => {
        executionStore.appendStreamOutput(nodeId, chunk)
      },
      onLog: (log) => {
        executionStore.addLog(log)
      },
    }

    let success = true

    for (const nodeId of executionOrder) {
      // Check for abort
      if (this.abortController.signal.aborted) {
        executionStore.cancelExecution()
        return false
      }

      // Check for paused state
      while (executionStore.status === 'paused') {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Check for cancelled
      if (executionStore.status === 'cancelled') {
        return false
      }

      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) continue

      const startTime = Date.now()

      // Update node status to running
      executionStore.updateNodeStatus(nodeId, {
        nodeId,
        status: 'running',
        timestamp: new Date().toISOString(),
        duration: 0,
      })

      executionStore.addLog({
        nodeId,
        nodeName: node.data.label,
        level: 'info',
        message: `Starting node: ${node.data.label}`,
      })

      try {
        // Build input from connected nodes
        const input = buildInputContext(nodeId, this.edges, executionStore.context?.nodeResults || new Map())

        // Get executor for this node type
        const executor = nodeExecutors[node.data.nodeType]
        if (!executor) {
          throw new Error(`No executor registered for node type: ${node.data.nodeType}`)
        }

        // Execute the node
        const output = await executor.execute(node, input, context)

        // Update variables from output
        if (typeof output === 'object' && output !== null) {
          Object.assign(variables, output)
        }

        // Record successful result
        const result: NodeExecutionResult = {
          nodeId,
          status: 'success',
          input,
          output,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        }

        executionStore.updateNodeStatus(nodeId, result)

        executionStore.addLog({
          nodeId,
          nodeName: node.data.label,
          level: 'info',
          message: `Completed node: ${node.data.label}`,
          data: output,
        })
      } catch (error) {
        success = false

        const errorMessage = error instanceof Error ? error.message : String(error)

        // Record error result
        const result: NodeExecutionResult = {
          nodeId,
          status: 'error',
          error: errorMessage,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        }

        executionStore.updateNodeStatus(nodeId, result)

        executionStore.addLog({
          nodeId,
          nodeName: node.data.label,
          level: 'error',
          message: `Error in node ${node.data.label}: ${errorMessage}`,
        })

        // Stop execution on error
        break
      }
    }

    executionStore.completeExecution(success)
    return success
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort()
    }
  }
}

// Execute workflow function
export async function executeWorkflow(): Promise<boolean> {
  const executionStore = useExecutionStore.getState()
  const workspaceStore = useWorkspaceStore.getState()
  const workflowStore = useWorkflowStore.getState()

  const workspace = workspaceStore.currentWorkspace
  if (!workspace) {
    executionStore.addLog({
      level: 'error',
      message: 'No workspace selected',
    })
    return false
  }

  const executor = new WorkflowExecutor(
    workflowStore.nodes,
    workflowStore.edges,
    workspace.path,
    workspace.config.ollamaHost
  )

  return executor.execute()
}
