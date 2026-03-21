/**
 * Agent Worker Adapter
 * 
 * 为现有的 AgentPage 提供兼容层
 * 将新的 Worker 系统包装成 IntelligentAgentExecutor 的 API
 */

import { useAgent } from '@/hooks/useAgent'
import type { AgentConfig as WorkerAgentConfig, AgentCallbacks } from '@/engine/workers/types'
import type { WorkflowInfo } from '@/engine/workflow-registry'

export interface AgentExecutorConfig {
  provider: string
  model: string
  apiEndpoint?: string
  apiKey?: string
  workflows: WorkflowInfo[]
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  sandboxPath?: string
  messages?: Array<{ role: string; content: string }>
}

export interface AgentExecutorCallbacks extends AgentCallbacks {
  onThoughtChunk?: (chunk: string) => void
  onResponseChunk?: (chunk: string) => void
  onReasoningChunk?: (chunk: string) => void
  onStepStart?: (step: { id: string; iteration: number; maxIterations: number; status: string; thought: string; thoughtStreaming: boolean; startedAt: number }) => void
  onStepUpdate?: (stepId: string, update: Partial<{ status: string; thought: string; thoughtStreaming: boolean }>) => void
  onStepComplete?: (stepId: string) => void
  onToolCallStart?: (toolCall: { id: string; toolName: string; toolType: 'builtin' | 'workflow'; status: string; input: Record<string, unknown> }) => void
  onToolCallUpdate?: (toolCallId: string, update: Partial<unknown>, index?: number) => void
  onToolCallComplete?: (toolCallId: string, result: { output?: unknown; error?: string }, index?: number) => void
  onToolCallsStart?: (toolCalls: Array<{ id: string; toolName: string; toolType: 'builtin' | 'workflow'; status: string; input: Record<string, unknown> }>) => void
  onTodosUpdate?: (items: Array<{ id: string; content: string; completed: boolean; createdAt: number }>) => void
  onWorkflowCall?: (call: unknown) => void
  onWorkflowUpdate?: (index: number, update: Partial<unknown>) => void
  onFilesGenerated?: (files: Array<{ path: string; name: string; size: number; createdAt: string }>) => void
  onComplete?: (response: string, generatedFiles?: Array<{ path: string; name: string; size: number; createdAt: string }>) => void
  onError?: (error: string) => void
  onIterationLimitReached?: (currentIteration: number, maxIterations: number) => void
  onThought?: (thought: string) => void
  onAction?: (action: string, input: unknown) => void
  onObservation?: (observation: string) => void
}

/**
 * 适配器钩子 - 将新的 Worker 系统包装成类似 IntelligentAgentExecutor 的 API
 */
export function useAgentWorkerAdapter(
  config: AgentExecutorConfig,
  callbacks: AgentExecutorCallbacks,
  sandboxPath: string
) {
  const workerConfig: WorkerAgentConfig = {
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    baseURL: config.apiEndpoint,
    sandboxPath: sandboxPath || config.sandboxPath || '',
    maxIterations: 10,
    workflows: config.workflows.map(w => ({
      id: w.id,
      name: w.name,
      path: w.path || '',
    })),
  }

  const { execute, cancel, status } = useAgent({
    sandboxPath: workerConfig.sandboxPath,
    priority: 'normal',
    onStepStart: callbacks.onStepStart,
    onStepUpdate: callbacks.onStepUpdate,
    onThoughtChunk: callbacks.onThoughtChunk ? (_stepId, chunk) => callbacks.onThoughtChunk!(chunk) : undefined,
    onToolCallsStart: (toolCalls) => {
      const adaptedToolCalls = toolCalls.map(tc => ({
        id: tc.id,
        toolName: tc.toolName,
        toolType: tc.toolType,
        status: 'pending' as const,
        input: tc.input,
        startedAt: Date.now(),
      }))
      callbacks.onToolCallsStart?.(adaptedToolCalls)
    },
    onToolCallUpdate: callbacks.onToolCallUpdate,
    onTodosUpdate: callbacks.onTodosUpdate,
    onComplete: callbacks.onComplete,
    onError: callbacks.onError,
    onIterationLimit: callbacks.onIterationLimitReached,
  })

  const executeWithAdapter = async (userInput: string, signal?: AbortSignal): Promise<string> => {
    try {
      const result = await execute(workerConfig, userInput)
      return result.response
    } catch (error) {
      if ((error as Error).message === 'Cancelled') {
        throw new Error('执行已取消')
      }
      throw error
    }
  }

  const setContinueParams = (startIteration: number, maxIterations: number, existingFiles?: Array<{ path: string; name: string; size: number; createdAt: string }>) => {
    // 新的 Worker 系统会在 execute 时自动处理继续参数
    console.log('[AgentWorkerAdapter] setContinueParams:', { startIteration, maxIterations, existingFiles })
  }

  return {
    execute: executeWithAdapter,
    cancel,
    setContinueParams,
    isRunning: status === 'running',
  }
}
