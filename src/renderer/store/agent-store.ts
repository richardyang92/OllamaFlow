import { create } from 'zustand'
import type { LLMProvider } from '@/engine/react-agent/llm/types'
import type { TodoItem } from '@/types/node'
import { useWorkspaceStore } from './workspace-store'

const DEBUG = false
const log = (...args: unknown[]) => DEBUG && console.log('[AgentStore]', ...args)

// ============ 对话历史类型 ============

// 对话元数据
export interface ConversationMeta {
  id: string
  title: string           // 对话标题
  createdAt: number
  updatedAt: number
  messageCount: number
  preview?: string        // 最后一条消息预览
}

// 对话内容（包含消息）
export interface ConversationData {
  meta: ConversationMeta
  messages: AgentMessage[]
}

// ============ 类型定义 ============

// 工具调用状态
export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'error'

// 工具类型
export type ToolType = 'builtin' | 'workflow' | 'system'

// ReAct Agent 详细执行信息（用于 SubAgent 进度展示）
export interface ReActAgentDetail {
  nodeId: string           // ReAct Agent 节点 ID
  nodeName: string         // 节点名称
  currentIteration: number // 当前迭代次数
  maxIterations: number    // 最大迭代次数
  currentStep?: {
    status: 'thinking' | 'acting' | 'observing' | 'completed'
    thought?: string       // 当前思考内容（截取前 100 字符）
    action?: string        // 当前执行的工具
  }
  totalSteps: number       // 已完成的步骤数
}

// SubAgent 执行进度
export interface SubAgentProgress {
  workflowName: string
  workflowPath: string
  status: 'loading' | 'running' | 'completed' | 'error'
  currentNode?: string        // 当前执行的节点名称
  nodeStatus?: 'pending' | 'running' | 'completed' | 'error'  // 当前节点状态
  totalNodes?: number         // 总节点数
  completedNodes?: number     // 已完成节点数
  logs: SubAgentLogEntry[]    // 执行日志
  startedAt: number
  updatedAt: number
  // ReAct Agent 详细执行信息（当当前节点是 ReAct Agent 时）
  reactAgentDetail?: ReActAgentDetail
}

// SubAgent 日志条目
export interface SubAgentLogEntry {
  id: string
  timestamp: number
  message: string
  type: 'info' | 'node_start' | 'node_complete' | 'node_error' | 'error'
  nodeName?: string
}

// 生成的文件信息
export interface GeneratedFileInfo {
  path: string           // 文件路径（相对工作区）
  workspacePath: string  // 所属工作区路径
  type?: 'created' | 'modified'  // 操作类型
  size?: number          // 文件大小
}

// 工具调用记录（增强版）
export interface ToolCallRecord {
  id: string
  toolName: string
  toolType: ToolType
  status: ToolCallStatus
  input: unknown
  output?: unknown
  error?: string
  startedAt: number
  completedAt?: number
  duration?: number
  metadata?: {
    filename?: string
    language?: string
    workflowPath?: string
    generatedFiles?: GeneratedFileInfo[]  // 工具调用生成的文件
  }
  // SubAgent 进度（仅 workflow 类型工具）
  subAgentProgress?: SubAgentProgress
}

// 推理步骤状态
export type AgentStepStatus = 'thinking' | 'acting' | 'observing' | 'completed' | 'error'

// 推理步骤（增强版）
export interface AgentStep {
  id: string
  iteration: number
  status: AgentStepStatus
  thought?: string
  thoughtStreaming?: boolean
  toolCall?: ToolCallRecord        // 保留兼容性：单个工具调用
  toolCalls?: ToolCallRecord[]     // 新增：并行工具调用数组
  observation?: string
  observationStreaming?: boolean
  observationError?: boolean
  startedAt: number
  completedAt?: number
}

// 工作流调用记录（保留兼容性）
export interface WorkflowCallRecord {
  workflowName: string
  workspacePath: string
  input: unknown
  output?: unknown
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
}

// 消息
export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  steps?: AgentStep[]
  workflowCalls?: WorkflowCallRecord[] // 保留兼容性
  isStreaming?: boolean
  responseStreaming?: boolean // 最终回复流式中
  generatedFiles?: GeneratedFileInfo[] // 本次执行生成的文件
}

// 任务状态
export interface AgentTodoState {
  items: TodoItem[]
  lastUpdated: number
}

// 执行日志条目
export interface ExecutionLogEntry {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  details?: unknown
}

// 可用工作流信息
export interface WorkflowInfo {
  id: string // 唯一标识，用于生成工具名称
  workspacePath: string
  name: string
  description?: string
}

// 执行状态
export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

// 持久化配置类型
interface AgentConfig {
  provider: LLMProvider
  model: string
  apiEndpoint?: string
  apiKey?: string
}

// 对话历史状态
export interface ConversationHistory {
  conversations: ConversationMeta[]
  currentConversationId: string | null
}

// ============ Store 状态接口 ============

interface AgentState {
  // 消息
  messages: AgentMessage[]
  isRunning: boolean
  executionStatus: ExecutionStatus

  // 任务状态
  todos: AgentTodoState

  // 执行日志
  executionLogs: ExecutionLogEntry[]

  // 模型配置
  provider: LLMProvider
  model: string
  apiEndpoint?: string
  apiKey?: string

  // 可用工作流
  availableWorkflows: WorkflowInfo[]

  // 面板状态
  isSettingsOpen: boolean
  showTodosPanel: boolean
  showLogsPanel: boolean

  // AbortController for stopping execution
  abortController?: AbortController

  // 初始化状态
  isInitialized: boolean

  // 对话历史
  conversationHistory: ConversationHistory
  searchQuery: string

  // ========== Actions ==========

  // 消息操作
  addMessage: (message: Omit<AgentMessage, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, update: Partial<AgentMessage>) => void
  deleteMessage: (id: string) => void
  deleteMessagesAfter: (id: string) => void  // 删除指定消息及其后面的所有消息
  clearMessages: () => void

  // 步骤操作
  appendStep: (messageId: string, step: AgentStep) => void
  updateStep: (messageId: string, stepId: string, update: Partial<AgentStep>) => void
  updateLastStep: (messageId: string, update: Partial<AgentStep>) => void

  // 流式更新操作
  appendThoughtChunk: (messageId: string, chunk: string) => void
  appendResponseChunk: (messageId: string, chunk: string) => void
  setThoughtStreaming: (messageId: string, streaming: boolean) => void
  setResponseStreaming: (messageId: string, streaming: boolean) => void

  // 工具调用操作
  addToolCall: (messageId: string, stepId: string, toolCall: ToolCallRecord) => void
  updateToolCall: (messageId: string, stepId: string, toolCallId: string, update: Partial<ToolCallRecord>) => void
  // 并行工具调用操作
  addToolCalls: (messageId: string, stepId: string, toolCalls: ToolCallRecord[]) => void
  updateToolCallByIndex: (messageId: string, stepId: string, index: number, update: Partial<ToolCallRecord>) => void

  // SubAgent 进度操作
  updateSubAgentProgress: (messageId: string, stepId: string, toolCallId: string, progress: Partial<SubAgentProgress>) => void
  addSubAgentLog: (messageId: string, stepId: string, toolCallId: string, log: Omit<SubAgentLogEntry, 'id' | 'timestamp'>) => void

  // 任务操作
  updateTodos: (items: TodoItem[]) => void
  clearTodos: () => void

  // 日志操作
  addExecutionLog: (entry: Omit<ExecutionLogEntry, 'id' | 'timestamp'>) => void
  clearExecutionLogs: () => void

  // 模型配置
  setModelConfig: (config: {
    model: string
    provider: LLMProvider
    apiEndpoint?: string
    apiKey?: string
  }) => void

  // 执行控制
  setRunning: (running: boolean) => void
  setExecutionStatus: (status: ExecutionStatus) => void
  setAbortController: (controller?: AbortController) => void

  // 工作流
  setAvailableWorkflows: (workflows: WorkflowInfo[]) => void
  loadWorkflows: () => Promise<void>

  // 面板控制
  setSettingsOpen: (open: boolean) => void
  setShowTodosPanel: (show: boolean) => void
  setShowLogsPanel: (show: boolean) => void

  // 持久化
  loadConfig: () => Promise<void>

  // 对话历史操作
  createConversation: () => Promise<string>
  switchConversation: (id: string) => void
  deleteConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  updateCurrentConversationMeta: () => void
  setSearchQuery: (query: string) => void
  loadConversationHistory: () => Promise<void>
  saveConversationHistory: () => Promise<void>
  saveCurrentConversation: () => Promise<void>

  // 兼容性操作（保留旧API）
  addWorkflowCall: (messageId: string, call: WorkflowCallRecord) => void
  updateWorkflowCall: (messageId: string, index: number, update: Partial<WorkflowCallRecord>) => void
}

// ============ ID 生成器 ============

let messageIdCounter = 0
let stepIdCounter = 0
let toolCallIdCounter = 0
let logIdCounter = 0
let conversationIdCounter = 0
let subAgentLogIdCounter = 0

const generateMessageId = () => `msg_${Date.now()}_${++messageIdCounter}`
export const generateStepId = () => `step_${Date.now()}_${++stepIdCounter}`
export const generateToolCallId = () => `tc_${Date.now()}_${++toolCallIdCounter}`
const generateLogId = () => `log_${Date.now()}_${++logIdCounter}`
const generateConversationId = () => `conv_${Date.now()}_${++conversationIdCounter}`
export const generateSubAgentLogId = () => `salog_${Date.now()}_${++subAgentLogIdCounter}`

// ============ Store 实现 ============

export const useAgentStore = create<AgentState>((set, _get) => ({
  // 初始状态
  messages: [],
  isRunning: false,
  executionStatus: 'idle',
  todos: { items: [], lastUpdated: 0 },
  executionLogs: [],
  provider: 'ollama',
  model: '',
  apiEndpoint: undefined,
  apiKey: undefined,
  availableWorkflows: [],
  isSettingsOpen: false,
  showTodosPanel: true,
  showLogsPanel: false,
  abortController: undefined,
  isInitialized: false,
  conversationHistory: {
    conversations: [],
    currentConversationId: null,
  },
  searchQuery: '',

  // ========== 消息操作 ==========

  addMessage: (message) => {
    const id = generateMessageId()
    const newMessage: AgentMessage = {
      ...message,
      id,
      timestamp: Date.now(),
    }
    log('addMessage', newMessage)
    set((state) => ({
      messages: [...state.messages, newMessage],
    }))
    return id
  },

  updateMessage: (id, update) => {
    log('updateMessage', id, update)
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...update } : msg
      ),
    }))
  },

  deleteMessage: (id) => {
    log('deleteMessage', id)
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== id),
    }))
  },

  deleteMessagesAfter: (id) => {
    log('deleteMessagesAfter', id)
    set((state) => {
      const index = state.messages.findIndex((msg) => msg.id === id)
      if (index === -1) return state
      // 删除该消息及其后面的所有消息
      return {
        messages: state.messages.slice(0, index),
      }
    })
  },

  clearMessages: () => {
    log('clearMessages')
    set({ messages: [] })
  },

  // ========== 步骤操作 ==========

  appendStep: (messageId, step) => {
    log('appendStep', messageId, step)
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        const steps = [...(msg.steps || []), step]
        return { ...msg, steps }
      }),
    }))
  },

  updateStep: (messageId, stepId, update) => {
    log('updateStep', messageId, stepId, update)
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        const steps = msg.steps?.map((step) =>
          step.id === stepId ? { ...step, ...update } : step
        )
        return { ...msg, steps }
      }),
    }))
  },

  updateLastStep: (messageId, update) => {
    log('updateLastStep', messageId, update)
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId || !msg.steps?.length) return msg
        const steps = [...msg.steps]
        steps[steps.length - 1] = { ...steps[steps.length - 1], ...update }
        return { ...msg, steps }
      }),
    }))
  },

  // ========== 流式更新操作 ==========

  appendThoughtChunk: (messageId, chunk) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId || !msg.steps?.length) return msg
        const steps = [...msg.steps]
        const lastStep = steps[steps.length - 1]
        if (lastStep.status === 'thinking') {
          steps[steps.length - 1] = {
            ...lastStep,
            thought: (lastStep.thought || '') + chunk,
          }
        }
        return { ...msg, steps }
      }),
    }))
  },

  appendResponseChunk: (messageId, chunk) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        return { ...msg, content: (msg.content || '') + chunk }
      }),
    }))
  },

  setThoughtStreaming: (messageId, streaming) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId || !msg.steps?.length) return msg
        const steps = [...msg.steps]
        const lastStep = steps[steps.length - 1]
        steps[steps.length - 1] = { ...lastStep, thoughtStreaming: streaming }
        return { ...msg, steps }
      }),
    }))
  },

  setResponseStreaming: (messageId, streaming) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        return { ...msg, responseStreaming: streaming }
      }),
    }))
  },

  // ========== 工具调用操作 ==========

  addToolCall: (messageId, stepId, toolCall) => {
    log('addToolCall', messageId, stepId, toolCall)
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        const steps = msg.steps?.map((step) => {
          if (step.id !== stepId) return step
          return { ...step, toolCall }
        })
        return { ...msg, steps }
      }),
    }))
  },

  updateToolCall: (messageId, stepId, toolCallId, update) => {
    log('updateToolCall', messageId, stepId, toolCallId, update)
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        const steps = msg.steps?.map((step) => {
          if (step.id !== stepId || !step.toolCall || step.toolCall.id !== toolCallId) return step
          return {
            ...step,
            toolCall: { ...step.toolCall, ...update },
          }
        })
        return { ...msg, steps }
      }),
    }))
  },

  // ========== 并行工具调用操作 ==========

  addToolCalls: (messageId, stepId, toolCalls) => {
    log('addToolCalls', messageId, stepId, toolCalls)
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        const steps = msg.steps?.map((step) => {
          if (step.id !== stepId) return step
          return { ...step, toolCalls }
        })
        return { ...msg, steps }
      }),
    }))
  },

  updateToolCallByIndex: (messageId, stepId, index, update) => {
    log('updateToolCallByIndex', messageId, stepId, index, update)
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        const steps = msg.steps?.map((step) => {
          if (step.id !== stepId || !step.toolCalls?.[index]) return step
          const newToolCalls = [...step.toolCalls]
          newToolCalls[index] = { ...newToolCalls[index], ...update }
          return { ...step, toolCalls: newToolCalls }
        })
        return { ...msg, steps }
      }),
    }))
  },

  // ========== SubAgent 进度操作 ==========

  updateSubAgentProgress: (messageId, stepId, toolCallId, progress) => {
    log('updateSubAgentProgress', messageId, stepId, toolCallId, progress)
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        const steps = msg.steps?.map((step) => {
          if (step.id !== stepId) return step

          // 处理单个 toolCall（旧模式）
          if (step.toolCall && step.toolCall.id === toolCallId) {
            const existingProgress = step.toolCall.subAgentProgress
            return {
              ...step,
              toolCall: {
                ...step.toolCall,
                subAgentProgress: {
                  ...existingProgress,
                  ...progress,
                  updatedAt: Date.now(),
                } as SubAgentProgress,
              },
            }
          }

          // 处理 toolCalls 数组（并行模式）
          if (step.toolCalls) {
            const toolCallIndex = step.toolCalls.findIndex(tc => tc.id === toolCallId)
            if (toolCallIndex !== -1) {
              const newToolCalls = [...step.toolCalls]
              const existingProgress = newToolCalls[toolCallIndex].subAgentProgress
              newToolCalls[toolCallIndex] = {
                ...newToolCalls[toolCallIndex],
                subAgentProgress: {
                  ...existingProgress,
                  ...progress,
                  updatedAt: Date.now(),
                } as SubAgentProgress,
              }
              return { ...step, toolCalls: newToolCalls }
            }
          }

          return step
        })
        return { ...msg, steps }
      }),
    }))
  },

  addSubAgentLog: (messageId, stepId, toolCallId, logEntry) => {
    log('addSubAgentLog', messageId, stepId, toolCallId, logEntry)
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        const steps = msg.steps?.map((step) => {
          if (step.id !== stepId) return step

          const newLog: SubAgentLogEntry = {
            ...logEntry,
            id: generateSubAgentLogId(),
            timestamp: Date.now(),
          }

          // 处理单个 toolCall（旧模式）
          if (step.toolCall && step.toolCall.id === toolCallId) {
            const existingProgress = step.toolCall.subAgentProgress
            return {
              ...step,
              toolCall: {
                ...step.toolCall,
                subAgentProgress: {
                  ...existingProgress,
                  logs: [...(existingProgress?.logs || []), newLog],
                  updatedAt: Date.now(),
                } as SubAgentProgress,
              },
            }
          }

          // 处理 toolCalls 数组（并行模式）
          if (step.toolCalls) {
            const toolCallIndex = step.toolCalls.findIndex(tc => tc.id === toolCallId)
            if (toolCallIndex !== -1) {
              const newToolCalls = [...step.toolCalls]
              const existingProgress = newToolCalls[toolCallIndex].subAgentProgress
              newToolCalls[toolCallIndex] = {
                ...newToolCalls[toolCallIndex],
                subAgentProgress: {
                  ...existingProgress,
                  logs: [...(existingProgress?.logs || []), newLog],
                  updatedAt: Date.now(),
                } as SubAgentProgress,
              }
              return { ...step, toolCalls: newToolCalls }
            }
          }

          return step
        })
        return { ...msg, steps }
      }),
    }))
  },

  // ========== 任务操作 ==========

  updateTodos: (items) => {
    log('updateTodos', items)
    set({ todos: { items, lastUpdated: Date.now() } })
  },

  clearTodos: () => {
    log('clearTodos')
    set({ todos: { items: [], lastUpdated: Date.now() } })
  },

  // ========== 日志操作 ==========

  addExecutionLog: (entry) => {
    const newEntry: ExecutionLogEntry = {
      ...entry,
      id: generateLogId(),
      timestamp: Date.now(),
    }
    set((state) => ({
      executionLogs: [...state.executionLogs, newEntry],
    }))
  },

  clearExecutionLogs: () => {
    set({ executionLogs: [] })
  },

  // ========== 模型配置 ==========

  setModelConfig: async (config) => {
    log('setModelConfig', config)
    set(config)
    // 持久化配置
    try {
      await window.electronAPI.agent.setConfig(config as AgentConfig)
      log('setModelConfig - saved to storage')
    } catch (error) {
      console.error('[AgentStore] Failed to save config:', error)
    }
  },

  // ========== 执行控制 ==========

  setRunning: (running) => {
    log('setRunning', running)
    set({ isRunning: running, executionStatus: running ? 'running' : 'idle' })
  },

  setExecutionStatus: (status) => {
    log('setExecutionStatus', status)
    set({ executionStatus: status })
  },

  setAbortController: (controller) => {
    set({ abortController: controller })
  },

  // ========== 工作流 ==========

  setAvailableWorkflows: (workflows) => {
    log('setAvailableWorkflows', workflows)
    set({ availableWorkflows: workflows })
  },

  loadWorkflows: async () => {
    try {
      log('loadWorkflows - starting')
      // 从recent workspaces加载工作流信息
      const workflows = await window.electronAPI.workflow.discoverAll()
      log('loadWorkflows - loaded', workflows)
      set({ availableWorkflows: workflows || [] })
    } catch (error) {
      console.error('[AgentStore] loadWorkflows error:', error)
      set({ availableWorkflows: [] })
    }
  },

  // ========== 面板控制 ==========

  setSettingsOpen: (open) => {
    set({ isSettingsOpen: open })
  },

  setShowTodosPanel: (show) => {
    set({ showTodosPanel: show })
  },

  setShowLogsPanel: (show) => {
    set({ showLogsPanel: show })
  },

  // ========== 持久化 ==========

  loadConfig: async () => {
    try {
      log('loadConfig - starting')
      const config = await window.electronAPI.agent.getConfig()
      log('loadConfig - loaded', config)
      if (config) {
        set({
          provider: config.provider,
          model: config.model,
          apiEndpoint: config.apiEndpoint,
          apiKey: config.apiKey,
          isInitialized: true,
        })
      } else {
        set({ isInitialized: true })
      }
    } catch (error) {
      console.error('[AgentStore] loadConfig error:', error)
      set({ isInitialized: true })
    }
  },

  // ========== 兼容性操作 ==========

  addWorkflowCall: (messageId, call) => {
    log('addWorkflowCall', messageId, call)
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        const workflowCalls = [...(msg.workflowCalls || []), call]
        return { ...msg, workflowCalls }
      }),
    }))
  },

  updateWorkflowCall: (messageId, index, update) => {
    log('updateWorkflowCall', messageId, index, update)
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId || !msg.workflowCalls?.[index]) return msg
        const workflowCalls = [...msg.workflowCalls]
        workflowCalls[index] = { ...workflowCalls[index], ...update }
        return { ...msg, workflowCalls }
      }),
    }))
  },

  // ========== 对话历史操作 ==========

  createConversation: async () => {
    const id = generateConversationId()
    const now = Date.now()
    const newConversation: ConversationMeta = {
      id,
      title: '新对话',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    }
    log('createConversation', newConversation)

    // 先获取当前状态
    const state = _get()
    const newHistory = {
      conversations: [newConversation, ...state.conversationHistory.conversations],
      currentConversationId: id,
    }

    set({
      conversationHistory: newHistory,
      messages: [],
      todos: { items: [], lastUpdated: now },
    })

    // 创建沙箱目录
    const workspacePath = useWorkspaceStore.getState().currentWorkspace?.path
    if (workspacePath) {
      try {
        await window.electronAPI.agent.createSandbox(workspacePath, id)
      } catch (error) {
        console.error('[AgentStore] Failed to create sandbox:', error)
      }
    }

    // 持久化对话列表
    window.electronAPI.agent.saveConversationHistory(newHistory).catch((error) => {
      console.error('[AgentStore] Failed to save conversation history:', error)
    })

    return id
  },

  switchConversation: async (id) => {
    log('switchConversation', id)
    const state = _get()

    // 先保存当前对话
    if (state.conversationHistory.currentConversationId) {
      await state.saveCurrentConversation()
    }

    // 加载目标对话的消息
    try {
      const data = await window.electronAPI.agent.getConversation(id)
      if (data) {
        set({
          messages: data.messages as AgentMessage[],
          conversationHistory: {
            ...state.conversationHistory,
            currentConversationId: id,
          },
        })
      } else {
        // 对话不存在，清空消息
        set({
          messages: [],
          conversationHistory: {
            ...state.conversationHistory,
            currentConversationId: id,
          },
        })
      }
    } catch (error) {
      console.error('[AgentStore] switchConversation error:', error)
      set({
        messages: [],
        conversationHistory: {
          ...state.conversationHistory,
          currentConversationId: id,
        },
      })
    }
  },

  deleteConversation: async (id) => {
    log('deleteConversation', id)
    const state = _get()

    // 构建新的历史记录
    const newHistory = {
      conversations: state.conversationHistory.conversations.filter((c) => c.id !== id),
      currentConversationId:
        state.conversationHistory.currentConversationId === id
          ? null
          : state.conversationHistory.currentConversationId,
    }

    // 更新状态
    set({
      conversationHistory: newHistory,
      ...(state.conversationHistory.currentConversationId === id && {
        messages: [],
        todos: { items: [], lastUpdated: Date.now() },
      }),
    })

    // 删除存储的消息数据
    try {
      await window.electronAPI.agent.deleteConversation(id)
    } catch (error) {
      console.error('[AgentStore] deleteConversation error:', error)
    }

    // 删除沙箱目录
    const workspacePath = useWorkspaceStore.getState().currentWorkspace?.path
    if (workspacePath) {
      try {
        await window.electronAPI.agent.deleteSandbox(workspacePath, id)
      } catch (error) {
        console.error('[AgentStore] Failed to delete sandbox:', error)
      }
    }

    // 持久化对话列表
    try {
      await window.electronAPI.agent.saveConversationHistory(newHistory)
    } catch (error) {
      console.error('[AgentStore] Failed to save conversation history:', error)
    }
  },

  renameConversation: (id, title) => {
    log('renameConversation', id, title)
    set((state) => {
      const newHistory = {
        ...state.conversationHistory,
        conversations: state.conversationHistory.conversations.map((c) =>
          c.id === id ? { ...c, title, updatedAt: Date.now() } : c
        ),
      }

      // 持久化对话列表
      window.electronAPI.agent.saveConversationHistory(newHistory).catch((error) => {
        console.error('[AgentStore] Failed to save conversation history:', error)
      })

      return { conversationHistory: newHistory }
    })
  },

  updateCurrentConversationMeta: () => {
    set((state) => {
      const { messages, conversationHistory } = state
      if (!conversationHistory.currentConversationId) return state

      const lastMessage = messages[messages.length - 1]
      const preview = lastMessage?.content?.slice(0, 50) || ''
      const currentConv = conversationHistory.conversations.find(
        (c) => c.id === conversationHistory.currentConversationId
      )
      const title =
        messages.length > 0 && currentConv?.title === '新对话'
          ? messages[0].content.slice(0, 30) || '新对话'
          : undefined

      const newHistory = {
        ...conversationHistory,
        conversations: conversationHistory.conversations.map((c) =>
          c.id === conversationHistory.currentConversationId
            ? {
                ...c,
                ...(title && { title }),
                messageCount: messages.length,
                preview,
                updatedAt: Date.now(),
              }
            : c
        ),
      }

      // 持久化对话列表（debounce 由调用方控制）
      window.electronAPI.agent.saveConversationHistory(newHistory).catch((error) => {
        console.error('[AgentStore] Failed to save conversation history:', error)
      })

      return { conversationHistory: newHistory }
    })
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  loadConversationHistory: async () => {
    try {
      log('loadConversationHistory - starting')
      const history = await window.electronAPI.agent.getConversationHistory()
      log('loadConversationHistory - loaded', history)
      if (history) {
        set({ conversationHistory: history })
      }
    } catch (error) {
      console.error('[AgentStore] loadConversationHistory error:', error)
    }
  },

  saveConversationHistory: async () => {
    try {
      const state = _get()
      await window.electronAPI.agent.saveConversationHistory(state.conversationHistory)
      log('saveConversationHistory - saved')
    } catch (error) {
      console.error('[AgentStore] saveConversationHistory error:', error)
    }
  },

  saveCurrentConversation: async () => {
    try {
      const state = _get()
      const { messages, conversationHistory } = state
      const currentId = conversationHistory.currentConversationId
      if (!currentId || messages.length === 0) return

      await window.electronAPI.agent.saveConversation(currentId, messages)
      log('saveCurrentConversation - saved', currentId)
    } catch (error) {
      console.error('[AgentStore] saveCurrentConversation error:', error)
    }
  },
}))
