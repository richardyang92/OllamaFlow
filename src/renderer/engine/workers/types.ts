/**
 * Agent Worker 类型定义
 * 定义主线程和 Worker 线程之间的通信协议
 */

import type { TodoItem } from '@/types/node'
import type { GeneratedFileInfo, SubAgentProgress } from '@/store/agent-store'

// ====== 基础配置类型 ======

export interface AgentConfig {
  provider: string
  model: string
  apiKey?: string
  baseURL?: string
  maxIterations?: number
  sandboxPath: string
  workflows?: Array<{ id: string; name: string; path: string }>
}

// ====== Agent 执行状态 ======

export interface AgentStep {
  id: string
  iteration: number
  maxIterations: number
  status: 'thinking' | 'acting' | 'completed' | 'error'
  thought: string
  thoughtStreaming: boolean
  observation?: string
  observationStreaming: boolean
  observationError: boolean
  startedAt: number
  completedAt?: number
}

// ====== 工具调用相关 ======

export interface ToolCallInfo {
  id: string
  toolName: string
  toolType: 'builtin' | 'workflow'
  input: Record<string, unknown>
}

export interface ToolResult {
  success: boolean
  output?: string
  error?: string
  subAgentProgress?: SubAgentProgress
}

// ====== Main -> Worker 消息 ======

export interface MsgStartExecution {
  type: 'START_EXECUTION'
  agentId: string
  config: AgentConfig
  userInput: string
  continueParams?: {
    startIteration: number
    maxIterations: number
    existingFiles?: GeneratedFileInfo[]
  }
}

export interface MsgCancelExecution {
  type: 'CANCEL_EXECUTION'
  agentId: string
}

export interface MsgToolResponse {
  type: 'TOOL_RESPONSE'
  requestId: string
  result: ToolResult
}

export interface MsgUserInput {
  type: 'USER_INPUT'
  agentId: string
  input: string
}

export type MainToWorkerMessage = 
  | MsgStartExecution 
  | MsgCancelExecution 
  | MsgToolResponse 
  | MsgUserInput

// ====== Worker -> Main 消息 ======

export interface MsgWorkerReady {
  type: 'WORKER_READY'
  workerId: string
}

export interface MsgStepStart {
  type: 'STEP_START'
  agentId: string
  step: AgentStep
}

export interface MsgStepUpdate {
  type: 'STEP_UPDATE'
  agentId: string
  stepId: string
  update: Partial<AgentStep>
}

export interface MsgThoughtChunk {
  type: 'THOUGHT_CHUNK'
  agentId: string
  stepId: string
  chunk: string
}

export interface MsgObservationChunk {
  type: 'OBSERVATION_CHUNK'
  agentId: string
  stepId: string
  chunk: string
  isError?: boolean
}

export interface MsgToolExecute {
  type: 'TOOL_EXECUTE'
  requestId: string
  agentId: string
  toolCall: ToolCallInfo
}

export interface MsgToolCallsStart {
  type: 'TOOL_CALLS_START'
  agentId: string
  toolCalls: ToolCallInfo[]
}

export interface MsgToolCallUpdate {
  type: 'TOOL_CALL_UPDATE'
  agentId: string
  toolCallId: string
  update: {
    status: 'pending' | 'running' | 'completed' | 'error'
    output?: string
    error?: string
    subAgentProgress?: SubAgentProgress
  }
}

export interface MsgTodosUpdate {
  type: 'TODOS_UPDATE'
  agentId: string
  items: TodoItem[]
}

export interface MsgExecutionComplete {
  type: 'EXECUTION_COMPLETE'
  agentId: string
  response: string
  generatedFiles?: GeneratedFileInfo[]
}

export interface MsgExecutionError {
  type: 'EXECUTION_ERROR'
  agentId: string
  error: string
}

export interface MsgIterationLimit {
  type: 'ITERATION_LIMIT'
  agentId: string
  currentIteration: number
  maxIterations: number
}

export interface MsgWaitingForInput {
  type: 'WAITING_FOR_INPUT'
  agentId: string
  prompt: string
  context?: string
}

export type WorkerToMainMessage =
  | MsgWorkerReady
  | MsgStepStart
  | MsgStepUpdate
  | MsgThoughtChunk
  | MsgObservationChunk
  | MsgToolExecute
  | MsgToolCallsStart
  | MsgToolCallUpdate
  | MsgTodosUpdate
  | MsgExecutionComplete
  | MsgExecutionError
  | MsgIterationLimit
  | MsgWaitingForInput

// ====== 回调接口（主线程使用）======

export interface AgentCallbacks {
  onStepStart?: (step: AgentStep) => void
  onStepUpdate?: (stepId: string, update: Partial<AgentStep>) => void
  onThoughtChunk?: (stepId: string, chunk: string) => void
  onObservationChunk?: (stepId: string, chunk: string, isError?: boolean) => void
  onToolCallStart?: (toolCall: ToolCallInfo) => void
  onToolCallsStart?: (toolCalls: ToolCallInfo[]) => void
  onToolCallUpdate?: (toolCallId: string, update: {
    status: 'pending' | 'running' | 'completed' | 'error'
    output?: string
    error?: string
    subAgentProgress?: SubAgentProgress
  }) => void
  onTodosUpdate?: (items: TodoItem[]) => void
  onComplete?: (response: string, generatedFiles?: GeneratedFileInfo[]) => void
  onError?: (error: string) => void
  onIterationLimit?: (currentIteration: number, maxIterations: number) => void
  onWaitingForInput?: (prompt: string, context?: string) => void
}

// ====== Worker 池状态 ======

export type WorkerStatus = 'idle' | 'busy' | 'reserved' | 'terminated'

export interface WorkerInstance {
  id: string
  worker: Worker
  status: WorkerStatus
  currentAgentId: string | null
  createdAt: number
  lastUsedAt: number
  taskCount: number
  errorCount: number
}

export type AgentSessionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AgentSession {
  id: string
  status: AgentSessionStatus
  priority: 'high' | 'normal' | 'low'
  workerId: string | null
  queuedAt: number
  startedAt: number | null
  completedAt: number | null
  config: AgentConfig
  userInput: string
  resolve: (value: { response: string; generatedFiles?: GeneratedFileInfo[] }) => void
  reject: (reason: Error) => void
  callbacks: AgentCallbacks
  abortController: AbortController
}
