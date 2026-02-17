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
export function buildInputContext(
  nodeId: string,
  edges: Edge[],
  nodeResults: Map<string, NodeExecutionResult>
): Record<string, unknown> {
  const context: Record<string, unknown> = {}

  // Find all incoming edges
  const incomingEdges = edges.filter((edge) => edge.target === nodeId)

  console.log('[buildInputContext] Building context for node:', nodeId, 'incoming edges:', incomingEdges.length)
  console.log('[buildInputContext] Available node results:', Array.from(nodeResults.keys()))

  for (const edge of incomingEdges) {
    const sourceResult = nodeResults.get(edge.source)
    console.log('[buildInputContext] Processing edge from', edge.source, 'result found:', !!sourceResult)

    if (sourceResult?.output) {
      // Map the output to the input port
      const sourceHandle = edge.sourceHandle
      const targetHandle = edge.targetHandle || 'input'

      // Debug: log the edge and source result
      console.log('[buildInputContext] Edge:', {
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        sourceOutput: sourceResult.output,
      })

      if (typeof sourceResult.output === 'object' && sourceResult.output !== null) {
        const outputObj = sourceResult.output as Record<string, unknown>
        // If there's a specific source handle, try to get that field
        if (sourceHandle && sourceHandle in outputObj) {
          context[targetHandle] = outputObj[sourceHandle]
          console.log('[buildInputContext] Mapped field:', sourceHandle, 'to', targetHandle)
        } else if (sourceHandle) {
          // Handle exists but field doesn't - use the whole output as fallback
          context[targetHandle] = sourceResult.output
          console.log('[buildInputContext] Handle not found in output, using whole output')
        } else {
          // No specific handle - use the whole output
          context[targetHandle] = sourceResult.output
          console.log('[buildInputContext] No source handle, using whole output')
        }
      } else {
        // Primitive output type
        context[targetHandle] = sourceResult.output
        console.log('[buildInputContext] Primitive output type')
      }
    }
  }

  console.log('[buildInputContext] Final context:', context)
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

  // Find start nodes (nodes with no incoming edges)
  const queue: string[] = []

  for (const node of nodes) {
    const degree = inDegree.get(node.id) || 0
    if (degree === 0) {
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
  userInputValues: Map<string, string>
  nodes?: Node<WorkflowNodeData>[]
  edges?: Edge[]
  signal?: AbortSignal
  onStream?: (nodeId: string, chunk: string) => void
  onLog?: (log: Omit<ExecutionLog, 'id' | 'timestamp' | 'executionId'>) => void
}

// Import node executors
import { createInputExecutor } from './nodes/input'
import { createOllamaChatExecutor } from './nodes/ollama-chat'
import { createSetExecutor } from './nodes/set'
import { createIfExecutor } from './nodes/if'
import { createLoopExecutor } from './nodes/loop'
import { createOutputExecutor } from './nodes/output'
import { createReadFileExecutor } from './nodes/read-file'
import { createWriteFileExecutor } from './nodes/write-file'
import { createExecuteCommandExecutor } from './nodes/execute-command'
import { createImageExecutor } from './nodes/image'

// Node executor registry
const nodeExecutors: Partial<Record<NodeType, NodeExecutor>> = {}

// Register all node executors
export function registerNodeExecutor(type: NodeType, executor: NodeExecutor) {
  nodeExecutors[type] = executor
}

// Get a node executor by type
export function getNodeExecutor(type: NodeType): NodeExecutor | undefined {
  return nodeExecutors[type]
}

// Initialize executors
export function initializeExecutors() {
  registerNodeExecutor('input', createInputExecutor())
  registerNodeExecutor('ollamaChat', createOllamaChatExecutor())
  registerNodeExecutor('set', createSetExecutor())
  registerNodeExecutor('if', createIfExecutor())
  registerNodeExecutor('loop', createLoopExecutor())
  registerNodeExecutor('output', createOutputExecutor())
  registerNodeExecutor('image', createImageExecutor())
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
  private userInputValues: Map<string, string> = new Map()

  constructor(
    nodes: Node<WorkflowNodeData>[],
    edges: Edge[],
    workspacePath: string,
    ollamaHost: string = 'http://127.0.0.1:11434',
    userInputValues?: Record<string, string>
  ) {
    this.nodes = nodes
    this.edges = edges
    this.workspacePath = workspacePath
    this.ollamaHost = ollamaHost
    if (userInputValues) {
      this.userInputValues = new Map(Object.entries(userInputValues))
    }
  }

  async execute(): Promise<boolean> {
    // Initialize executors if not done
    if (Object.keys(nodeExecutors).length === 0) {
      initializeExecutors()
    }

    // Start execution
    useExecutionStore.getState().startExecution('workflow')

    // Get execution order
    const executionOrder = getExecutionOrder(this.nodes, this.edges)

    this.abortController = new AbortController()
    const variables: Record<string, unknown> = {}

    const context: ExecutionContext = {
      workspacePath: this.workspacePath,
      ollamaHost: this.ollamaHost,
      variables,
      userInputValues: this.userInputValues,
      nodes: this.nodes,
      edges: this.edges,
      signal: this.abortController.signal,
      onStream: (nodeId, chunk) => {
        // Check if node still exists before appending stream output
        const currentWorkflowStore = useWorkflowStore.getState();
        const workflowNodes = currentWorkflowStore.nodes;
        if (workflowNodes.some(n => n.id === nodeId)) {
          useExecutionStore.getState().appendStreamOutput(nodeId, chunk)
        }
      },
      onLog: (log) => {
        useExecutionStore.getState().addLog(log)
      },
    }

    let success = true

    for (const nodeId of executionOrder) {
      const executionStore = useExecutionStore.getState()
      
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

      // Check if node still exists before updating status
      const currentWorkflowStore = useWorkflowStore.getState();
      const workflowNodes = currentWorkflowStore.nodes;
      if (!workflowNodes.some(n => n.id === nodeId)) {
        // Node has been deleted, skip execution
        continue;
      }
      
      // Find incoming edges to this node
      const incomingEdges = this.edges.filter((edge) => edge.target === nodeId)
      
      // Update incoming edges to be animated
      const workflowStore = useWorkflowStore.getState()
      const originalEdgeTypes = new Map<string, string>()
      
      incomingEdges.forEach(edge => {
        originalEdgeTypes.set(edge.id, edge.type || 'smoothstep')
        // Update edge type to animated
        const updatedEdges = workflowStore.edges.map(e => 
          e.id === edge.id ? { ...e, type: 'animated' } : e
        )
        workflowStore.setWorkflow({ ...workflowStore.workflow!, edges: updatedEdges })
      })

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
        message: `开始执行节点: ${node.data.label}`,
      })

      try {
        // Build input from connected nodes
        const input = buildInputContext(nodeId, this.edges, executionStore.context?.nodeResults || new Map())

        // Debug: Log input context
        context.onLog?.({
          nodeId,
          nodeName: node.data.label,
          level: 'debug',
          message: `Input context: ${JSON.stringify(input)}`,
        })

        // Get executor for this node type
        const executor = nodeExecutors[node.data.nodeType]
        if (!executor) {
          throw new Error(`未注册节点类型的执行器: ${node.data.nodeType}`)
        }

        // Execute the node
        const output = await executor.execute(node, input, context)

        // Update variables from output
        if (typeof output === 'object' && output !== null) {
          Object.assign(variables, output)
        }

        // Check if node still exists before recording result
        const currentWorkflowStore = useWorkflowStore.getState();
        const workflowNodes = currentWorkflowStore.nodes;
        if (!workflowNodes.some(n => n.id === nodeId)) {
          // Node has been deleted, skip result recording
          continue;
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

        // Restore original edge types
        const workflowStore = useWorkflowStore.getState()
        const updatedEdges = workflowStore.edges.map(e => {
          const originalType = originalEdgeTypes.get(e.id)
          return originalType ? { ...e, type: originalType } : e
        })
        workflowStore.setWorkflow({ ...workflowStore.workflow!, edges: updatedEdges })

        executionStore.addLog({
          nodeId,
          nodeName: node.data.label,
          level: 'info',
          message: `完成节点: ${node.data.label}`,
          data: output,
        })
      } catch (error) {
        success = false

        // Check if node still exists before recording error
        const currentWorkflowStore = useWorkflowStore.getState();
        const workflowNodes = currentWorkflowStore.nodes;
        if (!workflowNodes.some(n => n.id === nodeId)) {
          // Node has been deleted, skip error recording
          continue;
        }

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

        // Restore original edge types
        const workflowStore = useWorkflowStore.getState()
        const updatedEdges = workflowStore.edges.map(e => {
          const originalType = originalEdgeTypes.get(e.id)
          return originalType ? { ...e, type: originalType } : e
        })
        workflowStore.setWorkflow({ ...workflowStore.workflow!, edges: updatedEdges })

        executionStore.addLog({
          nodeId,
          nodeName: node.data.label,
          level: 'error',
          message: `节点 ${node.data.label} 出错: ${errorMessage}`,
        })

        // Stop execution on error
        break
      }
    }

    useExecutionStore.getState().completeExecution(success)
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
