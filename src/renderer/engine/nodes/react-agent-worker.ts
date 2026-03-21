/**
 * React Agent Worker Executor
 * 
 * Worker 版本的 React Agent 执行器
 * 用于工作流节点中的 ReAct Agent
 */

import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, ReactAgentNodeData } from '@/types/node'
import type { ExecutionContext } from '../executor'
import type { GeneratedFileInfo } from '@/store/agent-store'
import { useExecutionStore } from '@/store/execution-store'
import { useAgentAnalyticsStore } from '@/store/agent-analytics-store'
import { getWorkerPool } from '../workers/worker-pool'
import type { AgentConfig, AgentCallbacks, AgentStep, ToolCallInfo } from '../workers/types'
import type { TodoItem } from '@/types/node'

// 是否启用 Worker 模式
const ENABLE_WORKER_MODE = false // 默认关闭，通过配置开启

export interface ReactAgentWorkerOptions {
  node: Node<WorkflowNodeData>
  data: ReactAgentNodeData
  input: Record<string, unknown>
  context: ExecutionContext
}

/**
 * 使用 Worker 执行 React Agent
 */
export async function executeReactAgentInWorker(
  options: ReactAgentWorkerOptions
): Promise<unknown> {
  const { node, data, input, context } = options
  
  // 如果不启用 Worker 模式，返回 null 让调用者使用原版本
  if (!ENABLE_WORKER_MODE) {
    return null
  }
  
  const executionStore = useExecutionStore.getState()
  const analyticsStore = useAgentAnalyticsStore.getState()
  const executionId = `exec-${node.id}-${Date.now()}`
  
  // 初始化 ReAct 状态
  executionStore.initReActState(context.executionId, node.id, data.maxIterations || 10)
  analyticsStore.initExecution(node.id, executionId, input.userMessage as string || '', data.maxIterations || 10)
  
  // 准备 Agent 配置
  const agentConfig: AgentConfig = {
    provider: 'openai', // 从 data.model 推断
    model: data.model,
    apiKey: '', // 从全局配置获取
    baseURL: '', // 从全局配置获取
    sandboxPath: context.workspacePath,
    maxIterations: data.maxIterations || 10,
    workflows: [], // React Agent 不使用外部工作流
  }
  
  // 准备用户输入（包含变量插值）
  const userMessage = input.userMessage as string || ''
  
  // 当前步骤 ID
  let currentStepId: string | null = null
  const thinkingStartTimeRef: Record<string, number> = {}
  
  // 回调函数
  const callbacks: AgentCallbacks = {
    onStepStart: (step: AgentStep) => {
      currentStepId = step.id
      thinkingStartTimeRef[step.id] = Date.now()
      
      // 映射到 ReActStep 格式
      executionStore.updateReActStep(context.executionId, node.id, {
        id: step.id,
        iteration: step.iteration,
        maxIterations: step.maxIterations,
        status: step.status,
        thought: step.thought,
        thoughtStreaming: step.thoughtStreaming,
        startedAt: step.startedAt,
      })
      
      analyticsStore.updateMetrics({
        nodeId: node.id,
        executionId,
        type: 'thinking_start',
        timestamp: Date.now(),
        data: { startTime: Date.now(), iteration: step.iteration },
      })
      
      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `开始迭代 ${step.iteration}`,
      })
    },
    
    onStepUpdate: (stepId: string, update: Partial<AgentStep>) => {
      executionStore.updateReActStep(context.executionId, node.id, {
        id: stepId,
        ...update,
      })
    },
    
    onThoughtChunk: (_stepId: string, chunk: string) => {
      if (data.stream) {
        context.onStream?.(node.id, chunk)
      }
      
      // 更新思考内容
      if (currentStepId) {
        const currentStep = executionStore.getReActState(context.executionId, node.id)?.steps.find(s => s.id === currentStepId)
        if (currentStep) {
          executionStore.updateReActStep(context.executionId, node.id, {
            id: currentStepId,
            thought: currentStep.thought + chunk,
          })
        }
      }
    },
    
    onToolCallsStart: (toolCalls: ToolCallInfo[]) => {
      if (!currentStepId) return
      
      // 更新步骤为 acting 状态
      executionStore.updateReActStep(context.executionId, node.id, {
        id: currentStepId,
        status: 'acting',
        action: toolCalls.map(tc => tc.toolName).join(', '),
        actionInput: JSON.stringify(toolCalls.map(tc => tc.input)),
      })
      
      toolCalls.forEach(tc => {
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `调用工具: ${tc.toolName}`,
          details: tc.input,
        })
        
        analyticsStore.updateMetrics({
          nodeId: node.id,
          executionId,
          type: 'tool_start',
          timestamp: Date.now(),
          data: { toolId: tc.id, toolName: tc.toolName },
        })
        
        if (data.stream) {
          context.onStream?.(node.id, `🔧 正在调用: ${tc.toolName}\n`)
        }
      })
    },
    
    onToolCallUpdate: (toolCallId: string, update: { status: string; output?: string; error?: string }) => {
      if (update.status === 'completed') {
        analyticsStore.updateMetrics({
          nodeId: node.id,
          executionId,
          type: 'tool_end',
          timestamp: Date.now(),
          data: { toolId: toolCallId, success: true },
        })
        
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `工具执行完成`,
          details: { toolCallId, output: update.output },
        })
      } else if (update.status === 'error') {
        analyticsStore.updateMetrics({
          nodeId: node.id,
          executionId,
          type: 'tool_end',
          timestamp: Date.now(),
          data: { toolId: toolCallId, success: false },
        })
        
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'error',
          message: `工具执行失败: ${update.error}`,
        })
      }
    },
    
    onTodosUpdate: (items: TodoItem[]) => {
      // React Agent 使用自己的 TodosManager，这里只是同步显示
      // 实际的任务管理在 Worker 中完成
    },
    
    onComplete: (response: string, generatedFiles?: GeneratedFileInfo[]) => {
      if (currentStepId) {
        executionStore.completeReActStep(context.executionId, node.id, currentStepId)
      }
      
      executionStore.setReActFinalAnswer(context.executionId, node.id, response)
      
      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `任务完成`,
      })
      
      analyticsStore.updateMetrics({
        nodeId: node.id,
        executionId,
        type: 'execution_complete',
        timestamp: Date.now(),
        data: {},
      })
      
      if (data.stream) {
        context.onStream?.(node.id, `\n✅ 最终答案: ${response}\n`)
      }
    },
    
    onError: (error: string) => {
      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'error',
        message: error,
      })
      
      analyticsStore.updateMetrics({
        nodeId: node.id,
        executionId,
        type: 'execution_complete',
        timestamp: Date.now(),
        data: {},
      })
      
      throw new Error(error)
    },
    
    onIterationLimit: (current: number, max: number) => {
      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'warn',
        message: `达到最大迭代次数: ${current}/${max}`,
      })
    },
  }
  
  // 获取 Worker 池并执行
  const pool = getWorkerPool()
  
  try {
    const result = await pool.executeAgent(
      agentConfig,
      userMessage,
      callbacks,
      { priority: 'normal' }
    )
    
    return result.response
  } catch (error) {
    if ((error as Error).message === '执行已取消') {
      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: 'ReAct Agent 执行已取消',
      })
      return null
    }
    throw error
  }
}

/**
 * 检查是否应该使用 Worker 模式
 */
export function shouldUseWorkerMode(): boolean {
  return ENABLE_WORKER_MODE
}

/**
 * 设置 Worker 模式开关
 */
export function setWorkerMode(enabled: boolean): void {
  // 这里可以保存到 localStorage 或全局状态
  console.log(`[ReactAgentWorker] Worker mode ${enabled ? 'enabled' : 'disabled'}`)
}
