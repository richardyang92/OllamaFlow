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
    
    // For queue nodes, only count one in-degree (they can execute with any input)
    const targetNode = nodes.find(n => n.id === edge.target)
    if (targetNode?.data.nodeType === 'queue') {
      // Only increment if this is the first incoming edge for queue
      const currentDegree = inDegree.get(edge.target) || 0
      if (currentDegree === 0) {
        inDegree.set(edge.target, 1)
      }
    } else {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    }
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
      const neighborNode = nodes.find(n => n.id === neighbor)
      const currentDegree = inDegree.get(neighbor) || 0
      const newDegree = currentDegree - 1
      inDegree.set(neighbor, newDegree)
      
      // For queue nodes, they become ready when any predecessor is done
      if (neighborNode?.data.nodeType === 'queue' && !visited.has(neighbor)) {
        queue.push(neighbor)
      } else if (newDegree === 0 && !visited.has(neighbor)) {
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
import { createSmartRouterExecutor } from './nodes/smart-router'
import { createOutputExecutor } from './nodes/output'
import { createReadFileExecutor } from './nodes/read-file'
import { createWriteFileExecutor } from './nodes/write-file'
import { createExecuteCommandExecutor } from './nodes/execute-command'
import { createImageExecutor } from './nodes/image'
import { createReactAgentExecutor } from './nodes/react-agent'
import { createQueueExecutor } from './nodes/queue'
import { createSplitterExecutor } from './nodes/splitter'

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
  registerNodeExecutor('smartRouter', createSmartRouterExecutor())
  registerNodeExecutor('output', createOutputExecutor())
  registerNodeExecutor('image', createImageExecutor())
  registerNodeExecutor('readFile', createReadFileExecutor())
  registerNodeExecutor('writeFile', createWriteFileExecutor())
  registerNodeExecutor('executeCommand', createExecuteCommandExecutor())
  registerNodeExecutor('reactAgent', createReactAgentExecutor())
  registerNodeExecutor('queue', createQueueExecutor())
  registerNodeExecutor('splitter', createSplitterExecutor())
}

// Main workflow executor
export class WorkflowExecutor {
  private nodes: Node<WorkflowNodeData>[]
  private edges: Edge[]
  private workspacePath: string
  private ollamaHost: string
  private abortController: AbortController | null = null
  private userInputValues: Map<string, string> = new Map()
  private activeBranches: Map<string, string[]> = new Map()  // routerNodeId -> [activeBranchIds]

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
    const initialOrder = getExecutionOrder(this.nodes, this.edges)
    
    // Debug: log execution order and edges
    console.log('[WorkflowExecutor] Nodes:', this.nodes.map(n => ({ id: n.id, type: n.data.nodeType, label: n.data.label })))
    console.log('[WorkflowExecutor] Edges:', this.edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })))
    console.log('[WorkflowExecutor] Initial execution order:', initialOrder)

    this.abortController = new AbortController()
    const variables: Record<string, unknown> = {}
    
    // Clear active branches tracking
    this.activeBranches.clear()

    const context: ExecutionContext = {
      workspacePath: this.workspacePath,
      ollamaHost: this.ollamaHost,
      variables,
      userInputValues: this.userInputValues,
      nodes: this.nodes,
      edges: this.edges,
      signal: this.abortController.signal,
      onStream: (nodeId, chunk) => {
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
    
    // Track execution counts for each node (for cycle detection)
    const executionCounts = new Map<string, number>()
    const MAX_QUEUE_EXECUTIONS = 100 // Maximum times a queue node can execute

    // Build downstream map for triggering re-execution
    const downstreamMap = new Map<string, string[]>()
    for (const edge of this.edges) {
      const downstream = downstreamMap.get(edge.source) || []
      downstream.push(edge.target)
      downstreamMap.set(edge.source, downstream)
    }

    // Helper function to get downstream chain from a node
    const getDownstreamChain = (nodeId: string, visited: Set<string>): string[] => {
      const chain: string[] = []
      const downstream = downstreamMap.get(nodeId) || []
      for (const targetId of downstream) {
        if (!visited.has(targetId)) {
          visited.add(targetId)
          chain.push(targetId)
          chain.push(...getDownstreamChain(targetId, visited))
        }
      }
      return chain
    }

    // Execute a single node
    const executeNode = async (nodeId: string): Promise<boolean> => {
      const executionStore = useExecutionStore.getState()
      
      // Check for abort
      if (this.abortController!.signal.aborted) {
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
      if (!node) return true

      // Check if this node should be executed (conditional execution)
      if (!this.shouldExecuteNode(nodeId)) {
        executionStore.addLog({
          nodeId,
          nodeName: node.data.label,
          level: 'info',
          message: `跳过节点（来自未激活的分支）`,
        })
        return true
      }

      const startTime = Date.now()

      // Check if node still exists before updating status
      const currentWorkflowStore = useWorkflowStore.getState();
      const workflowNodes = currentWorkflowStore.nodes;
      if (!workflowNodes.some(n => n.id === nodeId)) {
        return true
      }
      
      // Find incoming edges to this node
      const incomingEdges = this.edges.filter((edge) => edge.target === nodeId)
      
      // Update incoming edges to be animated
      const workflowStore = useWorkflowStore.getState()
      
      // Batch update all incoming edges at once
      if (incomingEdges.length > 0) {
        const edgeIds = new Set(incomingEdges.map(e => e.id))
        const updatedEdges = workflowStore.edges.map(e => 
          edgeIds.has(e.id) ? { ...e, animated: true } : e
        )
        workflowStore.setWorkflow({ ...workflowStore.workflow!, edges: updatedEdges })
      }

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

        // Track active branches for smart router nodes
        if (node.data.nodeType === 'smartRouter') {
          const routerData = node.data as any
          const selectedBranchId = this.getSelectedBranchId(output, routerData.branches)
          this.activeBranches.set(node.id, [selectedBranchId])
          
          context.onLog?.({
            nodeId,
            nodeName: node.data.label,
            level: 'info',
            message: `激活分支: ${routerData.branches?.find((b: any) => b.id === selectedBranchId)?.name || selectedBranchId}`,
          })
        }

        // Check if node still exists before recording result
        const checkWorkflowStore = useWorkflowStore.getState();
        const checkWorkflowNodes = checkWorkflowStore.nodes;
        if (!checkWorkflowNodes.some(n => n.id === nodeId)) {
          return true
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

        // Restore edges to non-animated
        const restoreWorkflowStore = useWorkflowStore.getState()
        const edgeIds = new Set(incomingEdges.map(e => e.id))
        const updatedEdges = restoreWorkflowStore.edges.map(e => 
          edgeIds.has(e.id) ? { ...e, animated: false } : e
        )
        restoreWorkflowStore.setWorkflow({ ...restoreWorkflowStore.workflow!, edges: updatedEdges })

        executionStore.addLog({
          nodeId,
          nodeName: node.data.label,
          level: 'info',
          message: `完成节点: ${node.data.label}`,
          data: output,
        })

        // Check for queue nodes downstream that need re-execution
        if (output !== undefined) {
          const downstream = downstreamMap.get(nodeId) || []
          for (const targetId of downstream) {
            const targetNode = this.nodes.find(n => n.id === targetId)
            if (targetNode?.data.nodeType === 'queue') {
              const count = executionCounts.get(targetId) || 0
              if (count < MAX_QUEUE_EXECUTIONS) {
                // Queue node needs to be re-executed
                const shouldReExecute = true
                if (shouldReExecute) {
                  context.onLog?.({
                    nodeId: targetId,
                    nodeName: targetNode.data.label,
                    level: 'info',
                    message: `队列节点将被重新触发`,
                  })
                }
              }
            }
          }
        }

        return true
      } catch (error) {
        success = false

        const checkWorkflowStore = useWorkflowStore.getState();
        const checkWorkflowNodes = checkWorkflowStore.nodes;
        if (!checkWorkflowNodes.some(n => n.id === nodeId)) {
          return false
        }

        const errorMessage = error instanceof Error ? error.message : String(error)

        const result: NodeExecutionResult = {
          nodeId,
          status: 'error',
          error: errorMessage,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        }

        executionStore.updateNodeStatus(nodeId, result)

        // Restore edges to non-animated
        const restoreWorkflowStore = useWorkflowStore.getState()
        const edgeIds = new Set(incomingEdges.map(e => e.id))
        const updatedEdges = restoreWorkflowStore.edges.map(e => 
          edgeIds.has(e.id) ? { ...e, animated: false } : e
        )
        restoreWorkflowStore.setWorkflow({ ...restoreWorkflowStore.workflow!, edges: updatedEdges })

        executionStore.addLog({
          nodeId,
          nodeName: node.data.label,
          level: 'error',
          message: `节点 ${node.data.label} 出错: ${errorMessage}`,
        })

        return false
      }
    }

    // Main execution loop with cycle support
    const executionQueue: string[] = [...initialOrder]
    const executedInCurrentRound = new Set<string>()
    
    while (executionQueue.length > 0) {
      const nodeId = executionQueue.shift()!
      
      // Track execution count
      const currentCount = executionCounts.get(nodeId) || 0
      executionCounts.set(nodeId, currentCount + 1)
      
      // Check max executions for queue nodes
      const node = this.nodes.find(n => n.id === nodeId)
      if (node?.data.nodeType === 'queue' && currentCount >= MAX_QUEUE_EXECUTIONS) {
        context.onLog?.({
          nodeId,
          nodeName: node.data.label,
          level: 'warn',
          message: `队列节点达到最大执行次数 (${MAX_QUEUE_EXECUTIONS})`,
        })
        continue
      }
      
      const nodeSuccess = await executeNode(nodeId)
      if (!nodeSuccess) {
        break
      }
      
      executedInCurrentRound.add(nodeId)
      
      // After executing a node, check if any queue nodes need re-execution
      const executionStore = useExecutionStore.getState()
      const lastResult = executionStore.context?.nodeResults?.get(nodeId)
      
      if (lastResult?.output !== undefined) {
        const downstream = downstreamMap.get(nodeId) || []
        for (const targetId of downstream) {
          const targetNode = this.nodes.find(n => n.id === targetId)
          if (targetNode?.data.nodeType === 'queue') {
            // Add queue node and its downstream to execution queue
            const visited = new Set<string>([nodeId])
            const chain = getDownstreamChain(targetId, visited)
            executionQueue.push(targetId, ...chain)
          }
        }
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

  // Check if a node should be executed (conditional execution logic)
  private shouldExecuteNode(nodeId: string): boolean {
    // Find all incoming edges to this node
    const incomingEdges = this.edges.filter((edge) => edge.target === nodeId)
    
    for (const edge of incomingEdges) {
      const sourceNode = this.nodes.find((n) => n.id === edge.source)
      
      // If source node is a smart router
      if (sourceNode?.data.nodeType === 'smartRouter') {
        const activeBranchIds = this.activeBranches.get(sourceNode.id)
        
        // If source handle is not in active branches, this node should not execute
        if (activeBranchIds && edge.sourceHandle && !activeBranchIds.includes(edge.sourceHandle)) {
          return false
        }
      }
    }
    
    return true
  }

  // Get selected branch ID from smart router output
  private getSelectedBranchId(
    output: unknown,
    branches: Array<{ id: string; name: string; isDefault?: boolean }>
  ): string {
    if (typeof output !== 'object' || output === null) {
      throw new Error('智能路由节点必须返回对象')
    }
    
    const outputObj = output as Record<string, unknown>
    
    // Find the first branch with non-undefined value
    for (const branch of branches) {
      if (outputObj[branch.id] !== undefined) {
        return branch.id
      }
    }
    
    // If none found, return default branch
    const defaultBranch = branches.find(b => b.isDefault)
    if (defaultBranch) {
      return defaultBranch.id
    }
    
    throw new Error('智能路由节点未能选择分支，且没有默认分支')
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
