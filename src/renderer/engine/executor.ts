import type { Node, Edge } from '@xyflow/react'
import type { WorkflowNodeData, NodeType, SplitterNodeData } from '@/types/node'
import type { NodeExecutionResult, ExecutionLog } from '@/types/execution'
import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'

interface ParallelBranch {
  branchId: string
  startNodeId: string
  nodes: string[]
  joinNodeId?: string
}

interface GlobalExecutionStatus {
  workspacePath: string
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  startTime?: string
  endTime?: string
  progress: number
  totalNodes: number
  completedNodes: number
  currentNode?: string
  error?: string
}

// Expression evaluation - replaces {{variable}} patterns
export function interpolateVariables(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmedKey = key.trim()
    const value = getNestedValue(context, trimmedKey)
    if (value === undefined) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
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
  console.log('[buildInputContext] Full nodeResults:', JSON.stringify(Array.from(nodeResults.entries()).map(([k, v]) => [k, v.output]), null, 2))

  for (const edge of incomingEdges) {
    const sourceResult = nodeResults.get(edge.source)
    console.log('[buildInputContext] Processing edge from', edge.source, 'result found:', !!sourceResult, 'sourceHandle:', edge.sourceHandle, 'targetHandle:', edge.targetHandle)

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
import { createJoinExecutor } from './nodes/join'
import { planExecutor } from './nodes/plan'
import { createHttpRequestExecutor } from './nodes/http-request'
import { createDelayExecutor } from './nodes/delay'
import { createJsonExecutor } from './nodes/json'

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
  registerNodeExecutor('plan', planExecutor)
  registerNodeExecutor('queue', createQueueExecutor())
  registerNodeExecutor('splitter', createSplitterExecutor())
  registerNodeExecutor('join', createJoinExecutor())
  registerNodeExecutor('httpRequest', createHttpRequestExecutor())
  registerNodeExecutor('delay', createDelayExecutor())
  registerNodeExecutor('json', createJsonExecutor())
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
  private isPaused: boolean = false
  private isCancelled: boolean = false
  private isolatedMode: boolean = false

  constructor(
    nodes: Node<WorkflowNodeData>[],
    edges: Edge[],
    workspacePath: string,
    ollamaHost: string = 'http://127.0.0.1:11434',
    userInputValues?: Record<string, string>,
    isolatedMode: boolean = false
  ) {
    this.nodes = nodes
    this.edges = edges
    this.workspacePath = workspacePath
    this.ollamaHost = ollamaHost
    this.isolatedMode = isolatedMode
    if (userInputValues) {
      this.userInputValues = new Map(Object.entries(userInputValues))
    }
  }

  // Helper method to get workspace-specific state
  private getWorkspaceState() {
    const executionStore = useExecutionStore.getState()
    return executionStore.workspaces.get(this.workspacePath)
  }

  async execute(): Promise<boolean> {
    // Initialize executors if not done
    if (Object.keys(nodeExecutors).length === 0) {
      initializeExecutors()
    }

    // Start execution - use workspace-specific method in isolated mode
    const executionStore = useExecutionStore.getState()
    if (this.isolatedMode) {
      executionStore.startExecutionForWorkspace(this.workspacePath, 'workflow')
    } else {
      executionStore.startExecution(this.workspacePath, 'workflow')
    }

    // Get execution order
    const initialOrder = getExecutionOrder(this.nodes, this.edges)
    const totalNodes = initialOrder.length
    let completedNodes = 0

    // Update global execution status - running
    const updateGlobalStatus = (status: Partial<GlobalExecutionStatus>) => {
      const fullStatus: GlobalExecutionStatus = {
        workspacePath: this.workspacePath,
        status: 'running',
        progress: 0,
        totalNodes,
        completedNodes,
        ...status,
      }
      window.electronAPI.execution.updateStatus(fullStatus).catch(console.error)
    }

    // Initialize global status
    updateGlobalStatus({
      status: 'running',
      startTime: new Date().toISOString(),
      progress: 0,
    })
    
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
      if (this.abortController!.signal.aborted || this.isCancelled) {
        executionStore.cancelExecution()
        return false
      }

      // Check for paused state
      while (this.isPaused) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Check for cancelled
      const workspaceState = this.getWorkspaceState()
      if (workspaceState?.status === 'cancelled' || this.isCancelled) {
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
      
      // Update incoming edges to be animated (only if workflow is still loaded)
      const workflowStore = useWorkflowStore.getState()
      
      if (incomingEdges.length > 0 && workflowStore.workflow) {
        const edgeIds = new Set(incomingEdges.map(e => e.id))
        const updatedEdges = workflowStore.edges.map(e => 
          edgeIds.has(e.id) ? { ...e, animated: true } : e
        )
        workflowStore.setWorkflow({ ...workflowStore.workflow, edges: updatedEdges })
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
        // Build input from connected nodes - get fresh state from workspace for parallel execution
        const workspaceState = this.getWorkspaceState()
        const input = buildInputContext(nodeId, this.edges, workspaceState?.context?.nodeResults || new Map())

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

        // Check if node is waiting for user input
        if (typeof output === 'object' && output !== null && (output as any).status === 'waiting') {
          const waitingResult: NodeExecutionResult = {
            nodeId,
            status: 'success',
            input,
            output,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          }

          executionStore.updateNodeStatus(nodeId, waitingResult)

          // Restore edges to non-animated
          const restoreWorkflowStore = useWorkflowStore.getState()
          if (restoreWorkflowStore.workflow) {
            const edgeIds = new Set(incomingEdges.map(e => e.id))
            const updatedEdges = restoreWorkflowStore.edges.map(e => 
              edgeIds.has(e.id) ? { ...e, animated: false } : e
            )
            restoreWorkflowStore.setWorkflow({ ...restoreWorkflowStore.workflow, edges: updatedEdges })
          }

          executionStore.addLog({
            nodeId,
            nodeName: node.data.label,
            level: 'info',
            message: `节点 ${node.data.label} 等待用户输入...`,
          })

          // Wait for node to complete (status changes from waiting to success/error)
          await new Promise<void>((resolve) => {
            const checkCompletion = () => {
              const ws = this.getWorkspaceState()
              const nodeResult = ws?.context?.nodeResults?.get(nodeId)

              if (nodeResult?.status === 'success' || nodeResult?.status === 'error') {
                const output = nodeResult.output as any
                if (!output || output.status !== 'waiting') {
                  resolve()
                  return
                }
              }

              // Check again in 100ms
              setTimeout(checkCompletion, 100)
            }

            checkCompletion()
          })

          // Check if node completed with error (e.g., user cancelled)
          const finalWorkspaceState = this.getWorkspaceState()
          const finalResult = finalWorkspaceState?.context?.nodeResults?.get(nodeId)
          if (finalResult?.status === 'error') {
            return false
          }

          // Update variables from final output (after user input)
          if (finalResult?.output && typeof finalResult.output === 'object') {
            Object.assign(variables, finalResult.output)
          }

          return true
        }

        // Update variables from output (for non-waiting nodes)
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

        // Restore edges to non-animated (only if workflow is still loaded)
        const restoreWorkflowStore = useWorkflowStore.getState()
        if (restoreWorkflowStore.workflow) {
          const edgeIds = new Set(incomingEdges.map(e => e.id))
          const updatedEdges = restoreWorkflowStore.edges.map(e => 
            edgeIds.has(e.id) ? { ...e, animated: false } : e
          )
          restoreWorkflowStore.setWorkflow({ ...restoreWorkflowStore.workflow, edges: updatedEdges })
        }

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

        // Restore edges to non-animated (only if workflow is still loaded)
        const restoreWorkflowStore = useWorkflowStore.getState()
        if (restoreWorkflowStore.workflow) {
          const edgeIds = new Set(incomingEdges.map(e => e.id))
          const updatedEdges = restoreWorkflowStore.edges.map(e => 
            edgeIds.has(e.id) ? { ...e, animated: false } : e
          )
          restoreWorkflowStore.setWorkflow({ ...restoreWorkflowStore.workflow, edges: updatedEdges })
        }

        executionStore.addLog({
          nodeId,
          nodeName: node.data.label,
          level: 'error',
          message: `节点 ${node.data.label} 出错: ${errorMessage}`,
        })

        return false
      }
    }

    const executedNodes = new Set<string>()
    const skipNodes = new Set<string>()

    // Main execution loop with parallel support
    const executionQueue: string[] = [...initialOrder]
    
    while (executionQueue.length > 0) {
      const nodeId = executionQueue.shift()!
      
      if (skipNodes.has(nodeId)) {
        continue
      }
      
      if (executedNodes.has(nodeId)) {
        continue
      }
      
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
      
      executedNodes.add(nodeId)
      completedNodes++
      
      // Update global progress
      updateGlobalStatus({
        progress: Math.round((completedNodes / totalNodes) * 100),
        completedNodes,
        currentNode: node?.data.label,
      })
      
      // Handle parallel execution after splitter
      if (node?.data.nodeType === 'splitter') {
        const splitterData = node.data as SplitterNodeData
        const failureStrategy = splitterData.failureStrategy || 'continueOthers'
        const branches = this.identifyParallelBranches(nodeId)
        
        if (branches.length > 0) {
          const ws = this.getWorkspaceState()
          console.log('[Parallel] Splitter output before parallel execution:', ws?.context?.nodeResults?.get(nodeId)?.output)
          console.log('[Parallel] All nodeResults keys before parallel:', Array.from(ws?.context?.nodeResults?.keys() || []))
          
          context.onLog?.({
            nodeId,
            nodeName: node.data.label,
            level: 'info',
            message: `开始并行执行 ${branches.length} 个分支`,
          })
          
          console.log('[Parallel] Branch details:', branches.map(b => ({ branchId: b.branchId, startNodeId: b.startNodeId, nodes: b.nodes, joinNodeId: b.joinNodeId })))
          
          // Mark branch nodes as to be executed in parallel
          for (const branch of branches) {
            for (const branchNodeId of branch.nodes) {
              skipNodes.add(branchNodeId)
            }
          }
          
          // Execute branches in parallel
          console.log('[Parallel] Starting Promise.allSettled for branches')
          const branchResults = await Promise.allSettled(
            branches.map(branch => 
              this.executeBranchChain(branch, context, executeNode, variables)
            )
          )
          
          console.log('[Parallel] All branches completed')
          const wsAfter = this.getWorkspaceState()
          console.log('[Parallel] nodeResults after parallel:', Array.from(wsAfter?.context?.nodeResults?.keys() || []))
          console.log('[Parallel] Full nodeResults after parallel:', JSON.stringify(Array.from(wsAfter?.context?.nodeResults?.entries() || []).map(([k, v]) => [k, v.output]), null, 2))
          
          // Process results based on failure strategy
          let hasFailure = false
          for (let i = 0; i < branchResults.length; i++) {
            const result = branchResults[i]
            const branch = branches[i]
            
            if (result.status === 'fulfilled') {
              if (!result.value.success) {
                hasFailure = true
                context.onLog?.({
                  nodeId,
                  nodeName: node.data.label,
                  level: 'warn',
                  message: `分支 ${branch.branchId} 执行失败: ${result.value.error}`,
                })
              } else {
                for (const branchNodeId of branch.nodes) {
                  executedNodes.add(branchNodeId)
                  completedNodes++
                }
              }
            } else {
              hasFailure = true
              context.onLog?.({
                nodeId,
                nodeName: node.data.label,
                level: 'error',
                message: `分支 ${branch.branchId} 执行异常: ${result.reason}`,
              })
            }
          }
          
          if (hasFailure && failureStrategy === 'failAll') {
            context.onLog?.({
              nodeId,
              nodeName: node.data.label,
              level: 'error',
              message: `由于失败策略为"全部终止"，工作流已停止`,
            })
            success = false
            break
          }
          
          // Find join nodes and add them to queue
          const joinNodes = new Set<string>()
          for (const branch of branches) {
            if (branch.joinNodeId) {
              joinNodes.add(branch.joinNodeId)
            }
          }
          
          for (const joinNodeId of joinNodes) {
            if (!skipNodes.has(joinNodeId)) {
              executionQueue.push(joinNodeId)
            }
          }
          
          // Add nodes after join to the queue
          for (const joinNodeId of joinNodes) {
            const downstream = downstreamMap.get(joinNodeId) || []
            executionQueue.push(...downstream.filter(id => !executedNodes.has(id) && !skipNodes.has(id)))
          }
          
          updateGlobalStatus({
            progress: Math.round((completedNodes / totalNodes) * 100),
            completedNodes,
            currentNode: node?.data.label,
          })
        }
        
        continue
      }
      
      // After executing a node, check if any queue nodes need re-execution
      const workspaceState = this.getWorkspaceState()
      const lastResult = workspaceState?.context?.nodeResults?.get(nodeId)
      
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

    if (this.isolatedMode) {
      executionStore.completeExecutionForWorkspace(this.workspacePath, success)
    } else {
      executionStore.completeExecution(success)
    }
    
    // Update global execution status - completed/failed
    updateGlobalStatus({
      status: success ? 'completed' : 'failed',
      endTime: new Date().toISOString(),
      progress: 100,
      completedNodes,
    })
    
    return success
  }

  pause() {
    this.isPaused = true
    const executionStore = useExecutionStore.getState()
    if (this.isolatedMode) {
      executionStore.pauseExecution()
    } else {
      executionStore.pauseExecution()
    }
  }

  resume() {
    this.isPaused = false
    const executionStore = useExecutionStore.getState()
    if (this.isolatedMode) {
      executionStore.resumeExecution()
    } else {
      executionStore.resumeExecution()
    }
  }

  abort() {
    this.isCancelled = true
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

  private identifyParallelBranches(splitterNodeId: string): ParallelBranch[] {
    const branches: ParallelBranch[] = []
    const splitterOutgoingEdges = this.edges.filter(e => e.source === splitterNodeId)
    
    for (const edge of splitterOutgoingEdges) {
      const branchId = edge.sourceHandle || 'output1'
      const startNodeId = edge.target
      const branchNodes: string[] = []
      const visited = new Set<string>()
      
      const traverseBranch = (nodeId: string) => {
        if (visited.has(nodeId)) return
        visited.add(nodeId)
        
        const node = this.nodes.find(n => n.id === nodeId)
        if (!node) return
        
        if (node.data.nodeType === 'join') {
          return
        }
        
        branchNodes.push(nodeId)
        
        const outgoingEdges = this.edges.filter(e => e.source === nodeId)
        for (const outEdge of outgoingEdges) {
          traverseBranch(outEdge.target)
        }
      }
      
      traverseBranch(startNodeId)
      
      let joinNodeId: string | undefined
      for (const branchNodeId of branchNodes) {
        const outgoingFromBranch = this.edges.filter(e => e.source === branchNodeId)
        for (const outEdge of outgoingFromBranch) {
          const targetNode = this.nodes.find(n => n.id === outEdge.target)
          if (targetNode?.data.nodeType === 'join') {
            joinNodeId = outEdge.target
            break
          }
        }
        if (joinNodeId) break
      }
      
      branches.push({
        branchId,
        startNodeId,
        nodes: branchNodes,
        joinNodeId,
      })
    }
    
    return branches
  }

  private async executeBranchChain(
    branch: ParallelBranch,
    _context: ExecutionContext,
    executeNode: (nodeId: string) => Promise<boolean>,
    _variables: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`[Branch ${branch.branchId}] Starting execution, nodes:`, branch.nodes)
    const ws = this.getWorkspaceState()
    console.log(`[Branch ${branch.branchId}] nodeResults at start:`, Array.from(ws?.context?.nodeResults?.keys() || []))
    
    for (const nodeId of branch.nodes) {
      console.log(`[Branch ${branch.branchId}] Executing node: ${nodeId}`)
      if (this.isCancelled || this.abortController?.signal.aborted) {
        return { success: false, error: 'Cancelled' }
      }
      
      const nodeSuccess = await executeNode(nodeId)
      console.log(`[Branch ${branch.branchId}] Node ${nodeId} result:`, nodeSuccess ? 'success' : 'failed')
      
      if (!nodeSuccess) {
        return { success: false, error: `Node ${nodeId} failed` }
      }
    }
    console.log(`[Branch ${branch.branchId}] Completed successfully`)
    return { success: true }
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
