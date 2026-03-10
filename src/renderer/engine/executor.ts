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

  for (const edge of incomingEdges) {
    const sourceResult = nodeResults.get(edge.source)

    if (sourceResult?.output) {
      // Map the output to the input port
      const sourceHandle = edge.sourceHandle
      const targetHandle = edge.targetHandle || 'input'

      if (typeof sourceResult.output === 'object' && sourceResult.output !== null) {
        const outputObj = sourceResult.output as Record<string, unknown>
        // If there's a specific source handle, try to get that field
        if (sourceHandle && sourceHandle in outputObj) {
          context[targetHandle] = outputObj[sourceHandle]
        } else {
          // Handle exists but field doesn't, or no specific handle - use the whole output
          context[targetHandle] = sourceResult.output
        }
      } else {
        // Primitive output type
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
  executionId: string
  workspacePath: string
  apiEndpoint: string  // OpenAI-compatible endpoint
  apiKey?: string      // Optional API key for authentication
  variables: Record<string, unknown>
  userInputValues: Map<string, string>
  nodes?: Node<WorkflowNodeData>[]
  edges?: Edge[]
  signal?: AbortSignal
  onStream?: (nodeId: string, chunk: string) => void
  onReasoningStream?: (nodeId: string, chunk: string) => void  // For reasoning/thinking content
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
  private executionId: string
  private apiEndpoint: string
  private apiKey?: string
  private abortController: AbortController | null = null
  private userInputValues: Map<string, string> = new Map()
  private isPaused: boolean = false
  private isCancelled: boolean = false
  private isolatedMode: boolean = false

  constructor(
    nodes: Node<WorkflowNodeData>[],
    edges: Edge[],
    workspacePath: string,
    executionId: string,
    apiEndpoint: string = 'http://127.0.0.1:11434',
    userInputValues?: Record<string, string>,
    isolatedMode: boolean = false,
    apiKey?: string
  ) {
    this.nodes = nodes
    this.edges = edges
    this.workspacePath = workspacePath
    this.executionId = executionId
    this.apiEndpoint = apiEndpoint
    this.apiKey = apiKey
    this.isolatedMode = isolatedMode
    if (userInputValues) {
      this.userInputValues = new Map(Object.entries(userInputValues))
    }
  }

  async execute(): Promise<boolean> {
    // Initialize executors if not done
    if (Object.keys(nodeExecutors).length === 0) {
      initializeExecutors()
    }

    // Execution is already created with executionId, no need to call startExecution
    const executionStore = useExecutionStore.getState()

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
    
    // Initialize global status
    updateGlobalStatus({
      status: 'running',
      startTime: new Date().toISOString(),
      progress: 0,
    })

    this.abortController = new AbortController()
    const variables: Record<string, unknown> = {}

    const context: ExecutionContext = {
      executionId: this.executionId,
      workspacePath: this.workspacePath,
      apiEndpoint: this.apiEndpoint,
      apiKey: this.apiKey,
      variables,
      userInputValues: this.userInputValues,
      nodes: this.nodes,
      edges: this.edges,
      signal: this.abortController.signal,
      onStream: (nodeId, chunk) => {
        // 在隔离模式（subagent）下，使用 executor 自己的节点列表
        // 在普通模式下，使用 workflowStore 的节点列表（用于 UI 更新）
        if (this.isolatedMode) {
          // 隔离模式：直接追加输出，因为节点一定属于当前工作流
          executionStore.appendStreamOutput(this.executionId, nodeId, chunk)
        } else {
          // 普通模式：检查节点是否在当前编辑器的工作流中
          const currentWorkflowStore = useWorkflowStore.getState();
          const workflowNodes = currentWorkflowStore.nodes;
          if (workflowNodes.some(n => n.id === nodeId)) {
            executionStore.appendStreamOutput(this.executionId, nodeId, chunk)
          }
        }
      },
      onReasoningStream: (nodeId, chunk) => {
        // 在隔离模式（subagent）下，使用 executor 自己的节点列表
        // 在普通模式下，使用 workflowStore 的节点列表（用于 UI 更新）
        if (this.isolatedMode) {
          // 隔离模式：直接追加输出，因为节点一定属于当前工作流
          executionStore.appendReasoningStreamOutput(this.executionId, nodeId, chunk)
        } else {
          // 普通模式：检查节点是否在当前编辑器的工作流中
          const currentWorkflowStore = useWorkflowStore.getState();
          const workflowNodes = currentWorkflowStore.nodes;
          if (workflowNodes.some(n => n.id === nodeId)) {
            executionStore.appendReasoningStreamOutput(this.executionId, nodeId, chunk)
          }
        }
      },
      onLog: (log) => {
        executionStore.addLog(this.executionId, log)
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
        executionStore.cancelExecutionForWorkspace(this.workspacePath)
        return false
      }

      // Check for paused state
      while (this.isPaused) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Check for cancelled
      const execution = executionStore.getExecution(this.executionId)
      if (execution?.status === 'cancelled' || this.isCancelled) {
        return false
      }

      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return true

      // Check if this node should be executed (conditional execution)
      if (!this.shouldExecuteNode(nodeId)) {
        executionStore.addLog(this.executionId, {
          nodeId,
          nodeName: node.data.label,
          level: 'info',
          message: `跳过节点（来自未激活的分支）`,
        })
        return true
      }

      const startTime = Date.now()

      // Update node status to running
      executionStore.updateNodeStatus(this.executionId, nodeId, {
        nodeId,
        status: 'running',
        timestamp: new Date().toISOString(),
        duration: 0,
      })

      executionStore.addLog(this.executionId, {
        nodeId,
        nodeName: node.data.label,
        level: 'info',
        message: `开始执行节点: ${node.data.label}`,
      })

      try {
        // Build input from connected nodes - get fresh state from execution for parallel execution
        const execution = executionStore.getExecution(this.executionId)
        const input = buildInputContext(nodeId, this.edges, execution?.context?.nodeResults || new Map())

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
          executionStore.setActiveBranches(this.executionId, node.id, [selectedBranchId])
          
          context.onLog?.({
            nodeId,
            nodeName: node.data.label,
            level: 'info',
            message: `激活分支: ${routerData.branches?.find((b: any) => b.id === selectedBranchId)?.name || selectedBranchId}`,
          })
        }

        // Check if node is waiting for user input
        if (typeof output === 'object' && output !== null && (output as any).status === 'waiting') {
          const waitingResult: NodeExecutionResult = {
            nodeId,
            status: 'running',  // Keep as 'running' so edge animation continues
            input,
            output,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          }

          executionStore.updateNodeStatus(this.executionId, nodeId, waitingResult)

          executionStore.addLog(this.executionId, {
            nodeId,
            nodeName: node.data.label,
            level: 'info',
            message: `节点 ${node.data.label} 等待用户输入...`,
          })

          // Wait for node to complete (status changes from waiting to success/error)
          await new Promise<void>((resolve) => {
            const checkCompletion = () => {
              const execution = executionStore.getExecution(this.executionId)
              const nodeResult = execution?.context?.nodeResults?.get(nodeId)

              // If execution no longer exists, it was cancelled/stopped
              if (!execution) {
                resolve()
                return
              }

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
          const finalExecution = executionStore.getExecution(this.executionId)
          const finalResult = finalExecution?.context?.nodeResults?.get(nodeId)
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

        executionStore.updateNodeStatus(this.executionId, nodeId, result)

        executionStore.addLog(this.executionId, {
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

        const errorMessage = error instanceof Error ? error.message : String(error)

        const result: NodeExecutionResult = {
          nodeId,
          status: 'error',
          error: errorMessage,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        }

        executionStore.updateNodeStatus(this.executionId, nodeId, result)

        executionStore.addLog(this.executionId, {
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
          context.onLog?.({
            nodeId,
            nodeName: node.data.label,
            level: 'info',
            message: `开始并行执行 ${branches.length} 个分支`,
          })

          // Mark branch nodes as to be executed in parallel
          for (const branch of branches) {
            for (const branchNodeId of branch.nodes) {
              skipNodes.add(branchNodeId)
            }
          }

          // Execute branches in parallel
          const branchResults = await Promise.allSettled(
            branches.map(branch =>
              this.executeBranchChain(branch, context, executeNode, variables)
            )
          )

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
      const execution = executionStore.getExecution(this.executionId)
      const lastResult = execution?.context?.nodeResults?.get(nodeId)
      
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

    // Complete execution
    const finalExecutionStore = useExecutionStore.getState()
    const execution = finalExecutionStore.getExecution(this.executionId)
    if (execution) {
      const executions = new Map(finalExecutionStore.executions)
      executions.set(this.executionId, { 
        ...execution, 
        status: success ? 'completed' : 'failed' 
      })
      useExecutionStore.setState({ executions })
    }
    
    // Note: Execution cleanup can be done by calling executionStore.deleteExecution(this.executionId)
    // For now, we keep completed executions for history viewing
    // UI components or a cleanup service can delete old executions as needed
    
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
    const execution = executionStore.getExecution(this.executionId)
    if (execution) {
      const executions = new Map(executionStore.executions)
      executions.set(this.executionId, { ...execution, status: 'paused' })
      useExecutionStore.setState({ executions })
    }
  }

  resume() {
    this.isPaused = false
    const executionStore = useExecutionStore.getState()
    const execution = executionStore.getExecution(this.executionId)
    if (execution) {
      const executions = new Map(executionStore.executions)
      executions.set(this.executionId, { ...execution, status: 'running' })
      useExecutionStore.setState({ executions })
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
    
    const executionStore = useExecutionStore.getState()
    
    for (const edge of incomingEdges) {
      const sourceNode = this.nodes.find((n) => n.id === edge.source)
      
      // If source node is a smart router
      if (sourceNode?.data.nodeType === 'smartRouter') {
        const activeBranchIds = executionStore.getActiveBranches(this.executionId, sourceNode.id)
        
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
    for (const nodeId of branch.nodes) {
      if (this.isCancelled || this.abortController?.signal.aborted) {
        return { success: false, error: 'Cancelled' }
      }

      const nodeSuccess = await executeNode(nodeId)

      if (!nodeSuccess) {
        return { success: false, error: `Node ${nodeId} failed` }
      }
    }
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
    // Can't add log without executionId, just return false
    console.error('No workspace selected')
    return false
  }

  // Get API key for workspace
  const apiKey = await window.electronAPI.openai.getApiKey('workspace-default')

  // Create execution instance
  const executionId = executionStore.createExecution(workspace.path, 'workflow')

  const executor = new WorkflowExecutor(
    workflowStore.nodes,
    workflowStore.edges,
    workspace.path,
    executionId,
    workspace.config.apiEndpoint || 'http://127.0.0.1:11434',
    undefined,
    false,
    apiKey || undefined
  )

  return executor.execute()
}
