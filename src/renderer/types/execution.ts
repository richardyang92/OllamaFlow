export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export type NodeExecutionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'

export interface NodeExecutionResult {
  nodeId: string
  status: NodeExecutionStatus
  input?: unknown
  output?: unknown
  error?: string
  duration: number
  timestamp: string
}

export interface ExecutionContext {
  workflowId: string
  executionId: string
  startTime: string
  currentNodeId?: string
  nodeResults: Map<string, NodeExecutionResult>
  variables: Record<string, unknown>
}

export interface ExecutionLog {
  id: string
  executionId: string
  nodeId?: string
  nodeName?: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: string
  data?: unknown
}
