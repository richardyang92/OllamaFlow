/**
 * Agent Controller
 * 
 * 主线程控制器，负责：
 * 1. 管理 Worker 池
 * 2. 提供 Agent 执行接口
 * 3. 工具执行桥接（调用 electronAPI）
 */

import { getWorkerPool, type WorkerPoolManager } from './workers/worker-pool'
import type {
  AgentConfig,
  AgentCallbacks,
  ToolCallInfo,
  ToolResult,
} from './workers/types'
import { executeTool } from './tools'
import type { ExecutionContext } from './executor'

export interface ExecuteOptions {
  priority?: 'high' | 'normal' | 'low'
  signal?: AbortSignal
}

export class AgentController {
  private pool: WorkerPoolManager
  private sandboxPath: string

  constructor(sandboxPath: string) {
    this.pool = getWorkerPool()
    this.sandboxPath = sandboxPath
  }

  /**
   * 执行 Agent
   */
  async execute(
    config: AgentConfig,
    userInput: string,
    callbacks: AgentCallbacks,
    options: ExecuteOptions = {}
  ): Promise<{ response: string; generatedFiles?: { path: string; name: string; size: number; createdAt: string }[] }> {
    // 确保 sandboxPath 正确设置
    const fullConfig: AgentConfig = {
      ...config,
      sandboxPath: this.sandboxPath,
    }

    // 包装回调以支持工具执行
    const wrappedCallbacks: AgentCallbacks = {
      ...callbacks,
      onToolCallStart: async (toolCall) => {
        callbacks.onToolCallStart?.(toolCall)
      },
      onToolCallsStart: async (toolCalls) => {
        // 执行工具调用
        for (const toolCall of toolCalls) {
          await this.executeTool(toolCall, callbacks)
        }
        callbacks.onToolCallsStart?.(toolCalls)
      },
    }

    return this.pool.executeAgent(fullConfig, userInput, wrappedCallbacks, options)
  }

  /**
   * 取消执行
   */
  cancel(agentId: string): boolean {
    return this.pool.cancelAgent(agentId)
  }

  /**
   * 获取池状态
   */
  getPoolStatus() {
    return this.pool.getPoolStatus()
  }

  /**
   * 执行工具（桥接到主线程）
   */
  private async executeTool(
    toolCall: ToolCallInfo,
    callbacks: AgentCallbacks
  ): Promise<ToolResult> {
    const context: ExecutionContext = {
      workspacePath: this.sandboxPath,
    }

    try {
      // 调用工具执行
      const result = await executeTool(
        toolCall,
        context,
        callbacks
      )

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
