/**
 * Worker Pool Manager
 * 
 * 管理多个 Worker 实例，支持：
 * 1. Worker 池化（复用 Worker 实例）
 * 2. 多 Agent 并发执行
 * 3. 优先级队列
 * 4. 自动故障恢复
 */

import type {
  WorkerInstance,
  AgentSession,
  AgentConfig,
  AgentCallbacks,
  WorkerToMainMessage,
  MainToWorkerMessage,
} from './types'
import type { GeneratedFileInfo } from '@/store/agent-store'
import { executeToolInBridge, type ToolBridgeContext } from '../tool-bridge'

// Worker 构造函数类型
// @ts-ignore - Vite worker import
type WorkerConstructor = typeof import('./agent.worker.ts?worker').default

export interface WorkerPoolOptions {
  poolSize?: number        // Worker 池大小，默认 4
  maxConcurrent?: number   // 最大并发数，默认 4
  workerIdleTimeout?: number // Worker 空闲超时（毫秒），默认 5 分钟
}

export class WorkerPoolManager {
  private pool: Map<string, WorkerInstance> = new Map()
  private sessions: Map<string, AgentSession> = new Map()
  private queue: string[] = [] // 等待中的 agentId 队列
  
  private readonly poolSize: number
  private readonly maxConcurrent: number
  private readonly workerIdleTimeout: number
  
  private maintenanceInterval: ReturnType<typeof setInterval> | null = null
  private isInitialized = false

  constructor(options: WorkerPoolOptions = {}) {
    this.poolSize = options.poolSize || 4
    this.maxConcurrent = options.maxConcurrent || 4
    this.workerIdleTimeout = options.workerIdleTimeout || 300000 // 5 分钟
  }

  /**
   * 初始化 Worker 池
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return

    console.log('[WorkerPool] Initializing with size:', this.poolSize)

    // 创建 Worker 实例
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker(`worker-${i}`)
    }

    // 启动维护循环
    this.startMaintenanceLoop()

    this.isInitialized = true
    console.log('[WorkerPool] Initialized successfully')
  }

  /**
   * 销毁 Worker 池
   */
  public async terminate(): Promise<void> {
    console.log('[WorkerPool] Terminating...')

    // 停止维护循环
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval)
      this.maintenanceInterval = null
    }

    // 取消所有进行中的会话
    for (const [agentId, session] of this.sessions) {
      if (session.status === 'running') {
        this.cancelAgent(agentId)
      }
    }

    // 终止所有 Worker
    for (const [id, worker] of this.pool) {
      worker.worker.terminate()
      console.log('[WorkerPool] Worker terminated:', id)
    }

    this.pool.clear()
    this.sessions.clear()
    this.queue = []
    this.isInitialized = false

    console.log('[WorkerPool] Terminated')
  }

  /**
   * 执行 Agent
   */
  public async executeAgent(
    config: AgentConfig,
    userInput: string,
    callbacks: AgentCallbacks,
    options: {
      priority?: 'high' | 'normal' | 'low'
      signal?: AbortSignal
    } = {}
  ): Promise<{ response: string; generatedFiles?: GeneratedFileInfo[] }> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const priority = options.priority || 'normal'

    console.log('[WorkerPool] Queueing agent:', agentId, 'priority:', priority)

    // 创建会话
    const abortController = new AbortController()

    return new Promise((resolve, reject) => {
      const session: AgentSession = {
        id: agentId,
        status: 'queued',
        priority,
        workerId: null,
        queuedAt: Date.now(),
        startedAt: null,
        completedAt: null,
        config,
        userInput,
        resolve,
        reject,
        callbacks,
        abortController,
      }

      this.sessions.set(agentId, session)

      // 按优先级加入队列
      this.enqueueWithPriority(agentId, priority)

      // 尝试调度
      this.trySchedule()

      // 监听取消信号
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          this.cancelAgent(agentId)
          reject(new Error('Cancelled'))
        })
      }

      // 监听内部取消
      abortController.signal.addEventListener('abort', () => {
        reject(new Error('Cancelled'))
      })
    })
  }

  /**
   * 取消 Agent 执行
   */
  public cancelAgent(agentId: string): boolean {
    const session = this.sessions.get(agentId)
    if (!session) return false

    console.log('[WorkerPool] Cancelling agent:', agentId)

    if (session.status === 'queued') {
      // 从队列中移除
      const queueIndex = this.queue.indexOf(agentId)
      if (queueIndex > -1) {
        this.queue.splice(queueIndex, 1)
      }
      session.status = 'cancelled'
      session.abortController.abort()
      return true
    }

    if (session.status === 'running' && session.workerId) {
      const worker = this.pool.get(session.workerId)
      if (worker) {
        // 发送取消消息到 Worker
        this.sendToWorker(worker, {
          type: 'CANCEL_EXECUTION',
          agentId,
        })
        session.status = 'cancelled'
        session.abortController.abort()
        
        // 释放 Worker
        worker.status = 'idle'
        worker.currentAgentId = null
        worker.lastUsedAt = Date.now()
        
        // 重新调度
        this.trySchedule()
        return true
      }
    }

    return false
  }

  /**
   * 获取池状态
   */
  public getPoolStatus() {
    const idleWorkers = Array.from(this.pool.values()).filter(w => w.status === 'idle').length
    const busyWorkers = Array.from(this.pool.values()).filter(w => w.status === 'busy').length
    const queuedAgents = this.queue.length
    const activeSessions = Array.from(this.sessions.values()).filter(
      s => s.status === 'running'
    ).length

    return {
      totalWorkers: this.pool.size,
      idleWorkers,
      busyWorkers,
      queuedAgents,
      activeSessions,
    }
  }

  // ====== 私有方法 ======

  private createWorker(id: string): WorkerInstance {
    // 动态导入 Worker
    // @ts-ignore - Vite worker import
    const WorkerClass = new Worker(new URL('./agent.worker.ts', import.meta.url), {
      type: 'module',
    })

    const instance: WorkerInstance = {
      id,
      worker: WorkerClass,
      status: 'idle',
      currentAgentId: null,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      taskCount: 0,
      errorCount: 0,
    }

    // 设置消息处理
    WorkerClass.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
      this.handleWorkerMessage(id, event.data)
    }

    WorkerClass.onerror = (error) => {
      console.error('[WorkerPool] Worker error:', id, error)
      instance.errorCount++
      this.handleWorkerError(id)
    }

    this.pool.set(id, instance)
    console.log('[WorkerPool] Worker created:', id)

    return instance
  }

  private handleWorkerMessage(workerId: string, message: WorkerToMainMessage) {
    const worker = this.pool.get(workerId)
    if (!worker) return

    switch (message.type) {
      case 'WORKER_READY':
        console.log('[WorkerPool] Worker ready:', workerId)
        break

      case 'STEP_START':
        this.handleStepStart(message.agentId, message.step)
        break

      case 'STEP_UPDATE':
        this.handleStepUpdate(message.agentId, message.stepId, message.update)
        break

      case 'THOUGHT_CHUNK':
        this.handleThoughtChunk(message.agentId, message.stepId, message.chunk)
        break

      case 'OBSERVATION_CHUNK':
        this.handleObservationChunk(message.agentId, message.stepId, message.chunk, message.isError)
        break

      case 'TOOL_EXECUTE':
        this.handleToolExecute(workerId, message.requestId, message.agentId, message.toolCall)
        break

      case 'TOOL_CALLS_START':
        this.handleToolCallsStart(message.agentId, message.toolCalls)
        break

      case 'TOOL_CALL_UPDATE':
        this.handleToolCallUpdate(message.agentId, message.toolCallId, message.update)
        break

      case 'TODOS_UPDATE':
        this.handleTodosUpdate(message.agentId, message.items)
        break

      case 'EXECUTION_COMPLETE':
        this.handleExecutionComplete(message.agentId, message.response, message.generatedFiles)
        break

      case 'EXECUTION_ERROR':
        this.handleExecutionError(message.agentId, message.error)
        break

      case 'ITERATION_LIMIT':
        this.handleIterationLimit(message.agentId, message.currentIteration, message.maxIterations)
        break

      case 'WAITING_FOR_INPUT':
        this.handleWaitingForInput(message.agentId, message.prompt, message.context)
        break
    }
  }

  private handleWorkerError(workerId: string) {
    const worker = this.pool.get(workerId)
    if (!worker) return

    console.error('[WorkerPool] Handling worker error:', workerId)

    // 如果有正在执行的任务，标记为失败
    if (worker.currentAgentId) {
      const session = this.sessions.get(worker.currentAgentId)
      if (session && session.status === 'running') {
        session.status = 'failed'
        session.completedAt = Date.now()
        session.reject(new Error('Worker crashed'))
      }
    }

    // 重启 Worker
    this.restartWorker(workerId)
  }

  private restartWorker(workerId: string) {
    console.log('[WorkerPool] Restarting worker:', workerId)

    const worker = this.pool.get(workerId)
    if (worker) {
      worker.worker.terminate()
    }

    this.createWorker(workerId)
    this.trySchedule()
  }

  private enqueueWithPriority(agentId: string, priority: string) {
    const priorityWeights: Record<string, number> = { high: 0, normal: 1, low: 2 }
    const weight = priorityWeights[priority] ?? 1

    // 找到合适的位置插入
    let insertIndex = this.queue.length
    for (let i = 0; i < this.queue.length; i++) {
      const queuedAgentId = this.queue[i]
      const queuedSession = this.sessions.get(queuedAgentId)
      if (queuedSession) {
        const queuedWeight = priorityWeights[queuedSession.priority] ?? 1
        if (weight < queuedWeight) {
          insertIndex = i
          break
        }
      }
    }

    this.queue.splice(insertIndex, 0, agentId)
  }

  private trySchedule() {
    // 获取空闲 Worker
    const idleWorkers = Array.from(this.pool.values()).filter(w => w.status === 'idle')

    // 获取正在运行的 Agent 数量
    const runningCount = Array.from(this.sessions.values()).filter(
      s => s.status === 'running'
    ).length

    // 计算可启动的数量
    const availableSlots = Math.min(
      this.maxConcurrent - runningCount,
      idleWorkers.length,
      this.queue.length
    )

    for (let i = 0; i < availableSlots; i++) {
      const agentId = this.queue.shift()
      if (!agentId) break

      const worker = idleWorkers[i]
      const session = this.sessions.get(agentId)

      if (session) {
        this.startAgentExecution(worker, session)
      }
    }
  }

  private startAgentExecution(worker: WorkerInstance, session: AgentSession) {
    console.log('[WorkerPool] Starting agent execution:', session.id, 'on worker:', worker.id)

    worker.status = 'busy'
    worker.currentAgentId = session.id
    worker.lastUsedAt = Date.now()
    worker.taskCount++

    session.status = 'running'
    session.workerId = worker.id
    session.startedAt = Date.now()

    // 发送开始执行消息到 Worker
    this.sendToWorker(worker, {
      type: 'START_EXECUTION',
      agentId: session.id,
      config: session.config,
      userInput: session.userInput,
    })

    // 通知回调
    session.callbacks.onStepStart?.({
      id: `init-${session.id}`,
      iteration: 1,
      maxIterations: session.config.maxIterations || 10,
      status: 'thinking',
      thought: '',
      thoughtStreaming: true,
      observationStreaming: false,
      observationError: false,
      startedAt: Date.now(),
    })
  }

  private sendToWorker(worker: WorkerInstance, message: MainToWorkerMessage) {
    worker.worker.postMessage(message)
  }

  // ====== 消息处理转发 ======

  private handleStepStart(agentId: string, step: Parameters<AgentCallbacks['onStepStart']>[0]) {
    const session = this.sessions.get(agentId)
    if (session) {
      session.callbacks.onStepStart?.(step)
    }
  }

  private handleStepUpdate(
    agentId: string,
    stepId: string,
    update: Parameters<AgentCallbacks['onStepUpdate']>[1]
  ) {
    const session = this.sessions.get(agentId)
    if (session) {
      session.callbacks.onStepUpdate?.(stepId, update)
    }
  }

  private handleThoughtChunk(agentId: string, stepId: string, chunk: string) {
    const session = this.sessions.get(agentId)
    if (session) {
      session.callbacks.onThoughtChunk?.(stepId, chunk)
    }
  }

  private handleObservationChunk(
    agentId: string,
    stepId: string,
    chunk: string,
    isError?: boolean
  ) {
    const session = this.sessions.get(agentId)
    if (session) {
      session.callbacks.onObservationChunk?.(stepId, chunk, isError)
    }
  }

  private async handleToolExecute(
    workerId: string,
    requestId: string,
    agentId: string,
    toolCall: Parameters<AgentCallbacks['onToolCallStart']>[0]
  ) {
    const session = this.sessions.get(agentId)
    if (!session) return

    // 通知工具调用开始
    session.callbacks.onToolCallStart?.(toolCall)

    try {
      // 这里应该通过工具桥接执行工具
      // 暂时返回一个占位结果
      const result = await this.executeToolViaBridge(toolCall, session.config)

      // 发送结果回 Worker
      const worker = this.pool.get(workerId)
      if (worker) {
        this.sendToWorker(worker, {
          type: 'TOOL_RESPONSE',
          requestId,
          result,
        })
      }
    } catch (error) {
      // 发送错误结果
      const worker = this.pool.get(workerId)
      if (worker) {
        this.sendToWorker(worker, {
          type: 'TOOL_RESPONSE',
          requestId,
          result: {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        })
      }
    }
  }

  private handleToolCallsStart(agentId: string, toolCalls: Parameters<AgentCallbacks['onToolCallsStart']>[0]) {
    const session = this.sessions.get(agentId)
    if (session) {
      session.callbacks.onToolCallsStart?.(toolCalls)
    }
  }

  private handleToolCallUpdate(
    agentId: string,
    toolCallId: string,
    update: Parameters<AgentCallbacks['onToolCallUpdate']>[1]
  ) {
    const session = this.sessions.get(agentId)
    if (session) {
      session.callbacks.onToolCallUpdate?.(toolCallId, update)
    }
  }

  private handleTodosUpdate(agentId: string, items: Parameters<AgentCallbacks['onTodosUpdate']>[0]) {
    const session = this.sessions.get(agentId)
    if (session) {
      session.callbacks.onTodosUpdate?.(items)
    }
  }

  private handleExecutionComplete(
    agentId: string,
    response: string,
    generatedFiles?: GeneratedFileInfo[]
  ) {
    const session = this.sessions.get(agentId)
    if (!session) return

    console.log('[WorkerPool] Agent execution completed:', agentId)

    session.status = 'completed'
    session.completedAt = Date.now()

    // 释放 Worker
    if (session.workerId) {
      const worker = this.pool.get(session.workerId)
      if (worker) {
        worker.status = 'idle'
        worker.currentAgentId = null
        worker.lastUsedAt = Date.now()
      }
    }

    // 通知回调
    session.callbacks.onComplete?.(response, generatedFiles)
    session.resolve({ response, generatedFiles })

    // 清理会话
    this.sessions.delete(agentId)

    // 重新调度
    this.trySchedule()
  }

  private handleExecutionError(agentId: string, error: string) {
    const session = this.sessions.get(agentId)
    if (!session) return

    console.error('[WorkerPool] Agent execution error:', agentId, error)

    session.status = 'failed'
    session.completedAt = Date.now()

    // 释放 Worker
    if (session.workerId) {
      const worker = this.pool.get(session.workerId)
      if (worker) {
        worker.status = 'idle'
        worker.currentAgentId = null
        worker.lastUsedAt = Date.now()
      }
    }

    // 通知回调
    session.callbacks.onError?.(error)
    session.reject(new Error(error))

    // 清理会话
    this.sessions.delete(agentId)

    // 重新调度
    this.trySchedule()
  }

  private handleIterationLimit(agentId: string, currentIteration: number, maxIterations: number) {
    const session = this.sessions.get(agentId)
    if (session) {
      session.callbacks.onIterationLimit?.(currentIteration, maxIterations)
    }
  }

  private handleWaitingForInput(agentId: string, prompt: string, context?: string) {
    const session = this.sessions.get(agentId)
    if (session) {
      session.callbacks.onWaitingForInput?.(prompt, context)
    }
  }

  // ====== 工具执行桥接 ======

  private async executeToolViaBridge(
    toolCall: Parameters<AgentCallbacks['onToolCallStart']>[0],
    config: AgentConfig
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const context: ToolBridgeContext = {
        workspacePath: config.sandboxPath,
      }
      
      const result = await executeToolInBridge(toolCall, context)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // ====== 维护循环 ======

  private startMaintenanceLoop() {
    this.maintenanceInterval = setInterval(() => {
      const now = Date.now()

      for (const [id, worker] of this.pool) {
        // 检查 Worker 健康状态
        if (worker.status === 'busy') {
          const session = worker.currentAgentId
            ? this.sessions.get(worker.currentAgentId)
            : null

          // 检查是否执行超时 (30 分钟)
          if (session?.startedAt && now - session.startedAt > 1800000) {
            console.warn(`[WorkerPool] Worker ${id} execution timeout, restarting`)
            this.restartWorker(id)
          }
        }

        // 检查错误次数过多
        if (worker.errorCount > 5) {
          console.warn(`[WorkerPool] Worker ${id} has too many errors, restarting`)
          this.restartWorker(id)
        }
      }
    }, 60000) // 每分钟检查一次
  }
}

// 单例实例
let poolManager: WorkerPoolManager | null = null

export function getWorkerPool(options?: WorkerPoolOptions): WorkerPoolManager {
  if (!poolManager) {
    poolManager = new WorkerPoolManager(options)
  }
  return poolManager
}

export function resetWorkerPool(): void {
  if (poolManager) {
    poolManager.terminate()
    poolManager = null
  }
}
