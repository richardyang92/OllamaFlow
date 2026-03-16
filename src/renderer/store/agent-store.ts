import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
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

// ReAct 工具调用信息（用于 SubAgent 进度展示）
export interface ReActToolCallInfo {
  toolName: string
  input: unknown           // 解析后的输入参数
  output?: string | null   // 工具执行结果
  error?: string           // 错误信息
}

// ReAct 步骤详情（用于 SubAgent 进度展示）
export interface ReActStepDetail {
  id: string
  iteration: number
  maxIterations?: number   // 最大迭代次数（用于显示 X/XX 格式）
  status: 'thinking' | 'acting' | 'observing' | 'completed' | 'error'
  thought?: string         // 思考内容
  thoughtStreaming?: boolean
  toolCall?: ReActToolCallInfo
  observation?: string     // 观察结果
  observationStreaming?: boolean
  observationError?: boolean
  startedAt: number
  completedAt?: number
}

// ReAct Agent 详细执行信息（用于 SubAgent 进度展示）
export interface ReActAgentDetail {
  nodeId: string           // ReAct Agent 节点 ID
  nodeName: string         // 节点名称
  currentIteration: number // 当前迭代次数
  maxIterations: number    // 最大迭代次数
  currentStep?: ReActStepDetail   // 当前步骤（增强版）
  historySteps: ReActStepDetail[] // 历史步骤
  totalSteps: number       // 已完成的步骤数
}

// Ollama Chat 节点详细执行信息（用于 SubAgent 进度展示）
export interface OllamaChatDetail {
  nodeId: string           // 节点 ID
  nodeName: string         // 节点名称
  model: string            // 使用的模型
  reasoningContent?: string // 推理/思考内容（DeepSeek R1 等）
  reasoningStreaming?: boolean // 推理内容是否正在流式输出
  responseContent?: string  // 响应内容（截取预览）
  responseStreaming?: boolean // 响应是否正在流式输出
}

// ============ 时间线类型定义 ============

// 节点执行事件类型
export type NodeEventType =
  | 'node_start'
  | 'node_complete'
  | 'node_error'
  | 'thinking_stream'
  | 'output_stream'
  | 'tool_call_start'
  | 'tool_call_complete'

// ReAct Agent 步骤摘要（用于 SubAgent 进度展示）
export interface ReActStepSummary {
  iteration: number
  status: 'thinking' | 'acting' | 'observing' | 'completed' | 'error'
  thought?: string       // 思考内容摘要
  action?: string        // 执行的工具名称
  observation?: string   // 观察结果摘要
}

// SubAgent 执行进度（简化版 - 仅用于基本进度展示）
export interface SubAgentProgress {
  workflowName: string
  workflowPath: string
  status: 'loading' | 'running' | 'completed' | 'error'
  currentNode?: string        // 当前执行的节点名称
  currentNodeType?: string    // 当前执行的节点类型（如 'reactAgent', 'ollamaChat' 等）
  totalNodes?: number         // 总节点数
  completedNodes?: number     // 已完成节点数
  startedAt: number
  updatedAt: number
  // ReAct Agent 嵌套步骤（当 currentNodeType === 'reactAgent' 时使用）
  reactAgentSteps?: ReActStepSummary[]
  reactAgentIteration?: number  // 当前迭代次数
  reactAgentMaxIterations?: number  // 最大迭代次数
}

// SubAgent 进度的部分更新类型
export type PartialSubAgentProgress = Partial<Omit<SubAgentProgress, 'workflowName' | 'workflowPath'>> & {
  workflowName?: string
  workflowPath?: string
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
  maxIterations?: number  // 最大迭代次数（用于显示 X/XX 格式）
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
  reasoningContent?: string // 推理思考内容（DeepSeek R1 等）
  reasoningStreaming?: boolean // 推理内容流式中
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

  // 增量保存控制
  incrementalSaveEnabled: boolean  // 是否启用增量保存

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
  isHistoryLoaded: boolean  // 对话历史是否已加载完成

  // 对话历史
  conversationHistory: ConversationHistory
  searchQuery: string

  // 迭代限制状态
  iterationLimitReached: boolean    // 是否达到迭代上限
  currentIteration: number           // 当前迭代次数
  maxIterations: number              // 最大迭代次数

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
  // 推理内容流式操作
  appendReasoningChunk: (messageId: string, chunk: string) => void
  setReasoningStreaming: (messageId: string, streaming: boolean) => void
  clearReasoningContent: (messageId: string) => void

  // 工具调用操作
  addToolCall: (messageId: string, stepId: string, toolCall: ToolCallRecord) => void
  updateToolCall: (messageId: string, stepId: string, toolCallId: string, update: Partial<ToolCallRecord>) => void
  // 并行工具调用操作
  addToolCalls: (messageId: string, stepId: string, toolCalls: ToolCallRecord[]) => void
  updateToolCallByIndex: (messageId: string, stepId: string, index: number, update: Partial<ToolCallRecord>) => void

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
  saveCurrentConversationIncremental: () => Promise<void>  // 增量保存
  setIncrementalSaveEnabled: (enabled: boolean) => void  // 启用/禁用增量保存

  // 兼容性操作（保留旧API）
  addWorkflowCall: (messageId: string, call: WorkflowCallRecord) => void
  updateWorkflowCall: (messageId: string, index: number, update: Partial<WorkflowCallRecord>) => void

  // 迭代限制操作
  setIterationLimitReached: (reached: boolean, current: number, max: number) => void
  continueExecution: () => void
  clearIterationLimit: () => void
}

// ============ ID 生成器 ============

let messageIdCounter = 0
let stepIdCounter = 0
let toolCallIdCounter = 0
let logIdCounter = 0
let conversationIdCounter = 0

const generateMessageId = () => `msg_${Date.now()}_${++messageIdCounter}`
export const generateStepId = () => `step_${Date.now()}_${++stepIdCounter}`
export const generateToolCallId = () => `tc_${Date.now()}_${++toolCallIdCounter}`
const generateLogId = () => `log_${Date.now()}_${++logIdCounter}`
const generateConversationId = () => `conv_${Date.now()}_${++conversationIdCounter}`

// ============ 工具函数 ============

/**
 * 将 ConversationHistory 转换为纯对象，用于 IPC 通信
 * Immer 的 proxy 对象不能通过 structured clone，需要先转换为纯对象
 */
function serializeConversationHistory(history: ConversationHistory): {
  conversations: Array<{
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messageCount: number
    preview?: string
  }>
  currentConversationId: string | null
} {
  return {
    conversations: history.conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messageCount,
      preview: c.preview,
    })),
    currentConversationId: history.currentConversationId,
  }
}

// ============ Store 实现 ============

export const useAgentStore = create<AgentState>()(
  immer((set, _get) => ({
  // 初始状态
  messages: [],
  isRunning: false,
  executionStatus: 'idle',
  incrementalSaveEnabled: false,  // 增量保存开关
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
  isHistoryLoaded: false,
  conversationHistory: {
    conversations: [],
    currentConversationId: null,
  },
  searchQuery: '',

  // 迭代限制状态
  iterationLimitReached: false,
  currentIteration: 0,
  maxIterations: 10,

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
    set((state) => {
      const msg = state.messages.find(m => m.id === id)
      if (!msg) return

      // 使用 immer 直接修改
      Object.assign(msg, update)
    })
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
    set((state) => {
      const msg = state.messages.find(m => m.id === messageId)
      if (!msg?.steps) return

      const step = msg.steps.find(s => s.id === stepId)
      if (!step) return

      // 使用 immer 直接修改
      Object.assign(step, update)
    })
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
    set((state) => {
      const msg = state.messages.find(m => m.id === messageId)
      if (!msg?.steps?.length) return

      const lastStep = msg.steps[msg.steps.length - 1]
      if (lastStep.status === 'thinking') {
        // 使用 immer 直接修改，避免创建新数组
        lastStep.thought = (lastStep.thought || '') + chunk
      }
    })
  },

  appendResponseChunk: (messageId, chunk) => {
    set((state) => {
      const msg = state.messages.find(m => m.id === messageId)
      if (!msg) return

      // 使用 immer 直接修改
      msg.content = (msg.content || '') + chunk
    })
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

  // ========== 推理内容流式操作 ==========

  appendReasoningChunk: (messageId, chunk) => {
    log('appendReasoningChunk', messageId, chunk.substring(0, 50) + '...')
    set((state) => {
      const msg = state.messages.find(m => m.id === messageId)
      if (!msg) return

      // 使用 immer 直接修改
      msg.reasoningContent = (msg.reasoningContent || '') + chunk
      msg.reasoningStreaming = true
    })
  },

  setReasoningStreaming: (messageId, streaming) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        return { ...msg, reasoningStreaming: streaming }
      }),
    }))
  },

  clearReasoningContent: (messageId) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId) return msg
        return { ...msg, reasoningContent: '', reasoningStreaming: false }
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
    set((state) => {
      const msg = state.messages.find(m => m.id === messageId)
      if (!msg?.steps) return state

      const step = msg.steps.find(s => s.id === stepId)
      if (!step?.toolCall || step.toolCall.id !== toolCallId) return state

      // 使用 immer 直接修改
      Object.assign(step.toolCall, update)

      // 如果 update 包含 subAgentProgress，进行深度合并以保留现有字段
      if (update.subAgentProgress) {
        if (step.toolCall.subAgentProgress) {
          // 如果已有 subAgentProgress，合并更新字段
          Object.assign(step.toolCall.subAgentProgress, update.subAgentProgress)
        } else {
          // 如果没有 subAgentProgress，创建新的（使用合理的默认值）
          const progressData = update.subAgentProgress as Partial<SubAgentProgress>
          step.toolCall.subAgentProgress = {
            workflowName: progressData.workflowName || '',
            workflowPath: progressData.workflowPath || '',
            status: progressData.status || 'loading',
            startedAt: progressData.startedAt || Date.now(),
            updatedAt: progressData.updatedAt || Date.now(),
            ...progressData,
          } as SubAgentProgress
        }
      }

      return state
    })
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
    set((state) => {
      const msg = state.messages.find(m => m.id === messageId)
      if (!msg?.steps) return

      const step = msg.steps.find(s => s.id === stepId)
      if (!step?.toolCalls?.[index]) return

      const toolCall = step.toolCalls[index]
      // 使用 immer 直接修改，无需手动创建新对象
      Object.assign(toolCall, update)

      // 如果 update 包含 subAgentProgress，进行深度合并以保留现有字段
      if (update.subAgentProgress) {
        if (toolCall.subAgentProgress) {
          // 如果已有 subAgentProgress，合并更新字段
          Object.assign(toolCall.subAgentProgress, update.subAgentProgress)
        } else {
          // 如果没有 subAgentProgress，创建新的（使用合理的默认值）
          const progressData = update.subAgentProgress as Partial<SubAgentProgress>
          toolCall.subAgentProgress = {
            workflowName: progressData.workflowName || '',
            workflowPath: progressData.workflowPath || '',
            status: progressData.status || 'loading',
            startedAt: progressData.startedAt || Date.now(),
            updatedAt: progressData.updatedAt || Date.now(),
            ...progressData,
          } as SubAgentProgress
        }
      }
    })
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

      // 预加载每个工作流的输入节点元信息
      const { loadWorkflowInputMeta } = await import('../engine/workflow-registry')
      const workflowsWithMeta = await Promise.all(
        (workflows || []).map(async (w: {
          id: string
          workspacePath: string
          name: string
          description?: string
          inputNodes?: unknown
        }) => {
          // 如果已有输入节点信息，直接返回
          if (w.inputNodes) return w
          // 否则动态加载
          try {
            const inputNodes = await loadWorkflowInputMeta(w.workspacePath)
            return { ...w, inputNodes }
          } catch {
            return w
          }
        })
      )

      set({ availableWorkflows: workflowsWithMeta || [] })
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

  // 增量保存：保存当前对话消息（用于执行过程中实时保存）
  saveCurrentConversationIncremental: async () => {
    try {
      const state = _get()
      const { messages, conversationHistory, incrementalSaveEnabled } = state
      const currentId = conversationHistory.currentConversationId
      // 如果未启用增量保存，则跳过
      if (!incrementalSaveEnabled || !currentId || messages.length === 0) return

      await window.electronAPI.agent.saveConversation(currentId, messages)
      log('saveCurrentConversationIncremental - saved', currentId)
    } catch (error) {
      console.error('[AgentStore] saveCurrentConversationIncremental error:', error)
    }
  },

  // 启用/禁用增量保存
  setIncrementalSaveEnabled: (enabled: boolean) => {
    log('setIncrementalSaveEnabled', enabled)
    set({ incrementalSaveEnabled: enabled })
  },

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

    const newHistory: ConversationHistory = {
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
    window.electronAPI.agent.saveConversationHistory(serializeConversationHistory(newHistory)).catch((error) => {
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
    const newHistory: ConversationHistory = {
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
      await window.electronAPI.agent.saveConversationHistory(serializeConversationHistory(newHistory))
    } catch (error) {
      console.error('[AgentStore] Failed to save conversation history:', error)
    }
  },

  renameConversation: (id, title) => {
    log('renameConversation', id, title)

    // 先在 Immer 外部计算需要的数据
    const state = useAgentStore.getState()

    const newHistory: ConversationHistory = {
      ...state.conversationHistory,
      conversations: state.conversationHistory.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      ),
    }

    // 持久化对话列表
    window.electronAPI.agent.saveConversationHistory(serializeConversationHistory(newHistory)).catch((error) => {
      console.error('[AgentStore] Failed to save conversation history:', error)
    })

    // 更新状态
    set({
      conversationHistory: newHistory,
    })
  },

  updateCurrentConversationMeta: () => {
    // 先在 Immer 外部计算需要的数据
    const state = useAgentStore.getState()
    const { messages, conversationHistory } = state
    if (!conversationHistory.currentConversationId) return

    const lastMessage = messages[messages.length - 1]
    const preview = lastMessage?.content?.slice(0, 50) || ''
    const currentConv = conversationHistory.conversations.find(
      (c) => c.id === conversationHistory.currentConversationId
    )
    const title =
      messages.length > 0 && currentConv?.title === '新对话'
        ? messages[0].content.slice(0, 30) || '新对话'
        : undefined

    const newHistory: ConversationHistory = {
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
    window.electronAPI.agent.saveConversationHistory(serializeConversationHistory(newHistory)).catch((error) => {
      console.error('[AgentStore] Failed to save conversation history:', error)
    })

    // 更新状态
    set({
      conversationHistory: newHistory,
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
        // 如果有当前对话 ID，加载该对话的消息
        if (history.currentConversationId) {
          const data = await window.electronAPI.agent.getConversation(history.currentConversationId)
          if (data) {
            set({
              conversationHistory: history,
              messages: data.messages as AgentMessage[],
              isHistoryLoaded: true,
            })
            log('loadConversationHistory - restored messages', data.messages.length)
            return
          }
        }
        // 没有当前对话或加载失败，只设置历史记录
        set({
          conversationHistory: history,
          isHistoryLoaded: true,
        })
      } else {
        // 没有历史记录，标记为已加载
        set({ isHistoryLoaded: true })
      }
    } catch (error) {
      console.error('[AgentStore] loadConversationHistory error:', error)
      // 即使出错也标记为已加载，避免阻塞
      set({ isHistoryLoaded: true })
    }
  },

  saveConversationHistory: async () => {
    try {
      const state = _get()
      await window.electronAPI.agent.saveConversationHistory(serializeConversationHistory(state.conversationHistory))
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

  // ========== 迭代限制操作 ==========

  setIterationLimitReached: (reached: boolean, current: number, max: number) => {
    log('setIterationLimitReached', { reached, current, max })
    set({
      iterationLimitReached: reached,
      currentIteration: current,
      maxIterations: max,
      isRunning: false,  // 暂停执行
    })
  },

  continueExecution: () => {
    log('continueExecution')
    set({
      iterationLimitReached: false,
      maxIterations: (_get().maxIterations + 10),  // 增加10轮
      isRunning: true,  // 恢复执行
    })
  },

  clearIterationLimit: () => {
    log('clearIterationLimit')
    set({
      iterationLimitReached: false,
      currentIteration: 0,
      maxIterations: 10,
    })
  },
})))
