/**
 * Agent 页面 - 类似 Claude Code 的交互体验
 * 支持：
 * - 流式输出
 * - 结构化消息展示（思考过程、工具调用、最终回复）
 * - 任务列表面板
 * - 执行日志面板
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Square,
  Check,
  Sparkles,
  BarChart3,
} from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useAgentStore } from '@/store/agent-store'
import { useAgentAnalyticsStore } from '@/store/agent-analytics-store'
import type { AgentStep, ToolCallRecord, AgentMessage, GeneratedFileInfo } from '@/store/agent-store'
import type { OpenAIMessage } from '@/engine/openai-client'
import { IntelligentAgentExecutor, type HistoryMessage } from '@/engine/agent-executor'
import { resolveAIConfig } from '@/engine/config-resolver'
import { cn } from '@/lib/utils'
import {
  AgentMessageBlock,
  AgentSettingsPanel,
  AgentQuestionsManager,
  AgentInlineTodos,
  AgentInlineGeneratedFiles,
  AgentSidePanel,
  AgentIterationLimitPrompt,
  AgentExecutionHistoryPanel,
} from '@/components/agent'
import AgentSidebar from '@/components/agent/AgentSidebar'
import { AppHeader } from '@/components/layout'
import { AnimatedBackground } from '@/components/common'

// 反馈提示组件
function AgentFeedback({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg glass-floating text-green-400 text-sm font-medium shadow-lg flex items-center gap-2"
    >
      <Check className="w-4 h-4" />
      {message}
    </motion.div>
  )
}

// 输入区域组件
function ChatInput({
  input,
  setInput,
  onSend,
  onStop,
  isRunning,
  disabled,
  autoFocus = false,
}: {
  input: string
  setInput: (v: string) => void
  onSend: () => void
  onStop: () => void
  isRunning: boolean
  disabled: boolean
  autoFocus?: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const charCount = input.length
  const maxChars = 4000

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  useEffect(() => {
    if (autoFocus && textareaRef.current && !isRunning) {
      textareaRef.current.focus()
    }
  }, [autoFocus, isRunning])

  return (
    <div className="glass-panel rounded-2xl p-3">
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的问题... (Enter 发送，Shift+Enter 换行)"
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent',
              'text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)]',
              'focus:outline-none',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'pr-20'
            )}
          />
          
          <div className="absolute right-2 bottom-1 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            {charCount > 0 && (
              <span className={cn(
                'transition-colors',
                charCount > maxChars * 0.9 ? 'text-orange-400' : '',
                charCount > maxChars ? 'text-red-400' : ''
              )}>
                {charCount}
              </span>
            )}
            <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)]">
              ⏎
            </kbd>
          </div>
        </div>

        {isRunning ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            className={cn(
              'p-2.5 rounded-xl',
              'bg-red-500/60 text-white',
              'hover:bg-red-500/80 hover:shadow-lg hover:shadow-red-500/25',
              'transition-all duration-200'
            )}
          >
            <Square className="w-4 h-4" />
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSend}
            disabled={disabled || !input.trim()}
            className={cn(
              'p-2.5 rounded-xl',
              'bg-gradient-to-r from-blue-500/60 to-cyan-500/60 text-white',
              'hover:from-blue-500/80 hover:to-cyan-500/80',
              'hover:shadow-lg hover:shadow-blue-500/25',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
              'transition-all duration-200'
            )}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </div>
  )
}

export default function AgentPage() {
  const { setCurrentPage, currentWorkspace } = useWorkspaceStore()
  const {
    messages,
    isRunning,
    provider,
    model,
    apiEndpoint,
    apiKey,
    availableWorkflows,
    isSettingsOpen,
    showLogsPanel,
    todos,
    setSettingsOpen,
    setShowLogsPanel,
    addMessage,
    updateMessage,
    deleteMessage,
    deleteMessagesAfter,
    setRunning,
    loadWorkflows,
    loadConfig,
    appendStep,
    updateStep,
    updateLastStep,
    updateTodos,
    addExecutionLog,
    updateToolCall,
    addToolCalls,
    updateToolCallByIndex,
    // 对话历史
    conversationHistory,
    isHistoryLoaded,
    createConversation,
    loadConversationHistory,
    saveCurrentConversation,
    saveCurrentConversationIncremental,
    setIncrementalSaveEnabled,
    updateCurrentConversationMeta,
    // 迭代限制
    iterationLimitReached,
    currentIteration,
    setIterationLimitReached,
    continueExecution,
    clearIterationLimit,
  } = useAgentStore()

  // 获取当前对话标题
  const currentConversationTitle = useMemo(() => {
    if (!conversationHistory.currentConversationId) return null
    const currentConversation = conversationHistory.conversations.find(
      c => c.id === conversationHistory.currentConversationId
    )
    return currentConversation?.title || null
  }, [conversationHistory.currentConversationId, conversationHistory.conversations])

  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showExecutionHistory, setShowExecutionHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentStepIdRef = useRef<string | null>(null)
  const currentExecutionIdRef = useRef<string | null>(null)
  const currentIterationRef = useRef<number>(0)
  const thinkingStartTimeRef = useRef<number | null>(null)
  const lastSaveTimeRef = useRef(0) // 用于控制保存频率
  const SAVE_MIN_INTERVAL = 10000 // 最小保存间隔10秒

  // 获取 analytics store 方法
  const { initExecution, updateMetrics, completeExecution } = useAgentAnalyticsStore()

  // 加载配置、工作流列表和对话历史
  useEffect(() => {
    loadConfig()
    loadWorkflows()
    loadConversationHistory()
  }, [loadConfig, loadWorkflows, loadConversationHistory])

  // 如果没有当前对话，自动创建一个（等待历史加载完成后再判断）
  useEffect(() => {
    if (isHistoryLoaded && conversationHistory.currentConversationId === null && !isRunning) {
      createConversation()
    }
  }, [isHistoryLoaded, conversationHistory.currentConversationId, createConversation, isRunning])

  // 自动保存当前对话（优化版本：执行中不保存，增加保存间隔）
  useEffect(() => {
    // 【关键】执行中不保存，避免频繁序列化
    if (isRunning) return

    if (messages.length === 0 || !conversationHistory.currentConversationId) return

    const now = Date.now()
    // 【关键】距离上次保存太近则跳过，避免频繁保存
    if (now - lastSaveTimeRef.current < SAVE_MIN_INTERVAL) {
      return
    }

    updateCurrentConversationMeta()
    const timer = setTimeout(() => {
      lastSaveTimeRef.current = Date.now()
      saveCurrentConversation()
    }, 3000) // 增加到3秒

    return () => clearTimeout(timer)
  }, [messages, conversationHistory.currentConversationId, isRunning, updateCurrentConversationMeta, saveCurrentConversation])

  // 滚动到底部（仅当用户已在底部附近时）
  useEffect(() => {
    if (!messagesContainerRef.current) return

    const container = messagesContainerRef.current
    // 检查用户是否在底部附近（距离底部小于100px）
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleBack = useCallback(() => {
    if (isRunning) {
      const confirm = window.confirm('Agent正在运行中，确定要返回吗？')
      if (!confirm) return
    }
    abortControllerRef.current?.abort()
    setCurrentPage('welcome')
  }, [isRunning, setCurrentPage])

  // 核心执行函数
  // continueParams 用于继续执行时传递参数
  const executeAgent = useCallback(async (
    userInput: string,
    historyMessages: AgentMessage[],
    continueParams?: {
      startIteration: number
      maxIterations: number
      assistantMsgId: string
      existingMessages: OpenAIMessage[]
      generatedFiles?: GeneratedFileInfo[]
    }
  ) => {
    if (!model) {
      setFeedback('请先在设置中选择模型')
      setTimeout(() => setFeedback(null), 2000)
      setSettingsOpen(true)
      return
    }

    let assistantMsgId: string

    if (continueParams) {
      // 继续执行：使用现有的助手消息
      assistantMsgId = continueParams.assistantMsgId
      updateMessage(assistantMsgId, { isStreaming: true })
    } else {
      // 新执行：添加用户消息和创建助手消息
      addMessage({ role: 'user', content: userInput })
      assistantMsgId = addMessage({
        role: 'assistant',
        content: '',
        isStreaming: true,
      })
    }

    setRunning(true)
    abortControllerRef.current = new AbortController()

    // 初始化分析
    const executionId = `exec-${assistantMsgId}-${Date.now()}`
    currentExecutionIdRef.current = executionId
    currentIterationRef.current = 0
    thinkingStartTimeRef.current = null

    let history: HistoryMessage[] | undefined
    let messages: OpenAIMessage[] | undefined

    // 根据是否继续执行设置不同的参数
    if (continueParams) {
      // 继续执行
      currentIterationRef.current = continueParams.startIteration
      initExecution(assistantMsgId, executionId, userInput, continueParams.maxIterations)

      history = undefined
      messages = continueParams.existingMessages
    } else {
      // 新执行
      initExecution(assistantMsgId, executionId, userInput, 10)

      // 构建历史消息上下文
      history = historyMessages.map(m => ({
        role: m.role,
        content: m.content,
      }))
      messages = undefined
    }

    try {
      // 获取流式追加方法
      const { appendThoughtChunk, appendReasoningChunk } = useAgentStore.getState()

      // 启用增量保存模式
      setIncrementalSaveEnabled(true)

      // 获取沙箱路径
      let sandboxPath: string | undefined
      const workspacePath = currentWorkspace?.path
      const conversationId = conversationHistory.currentConversationId

      if (conversationId) {
        if (workspacePath) {
          // 有工作区：使用工作区下的 .agent-sandbox 目录
          const createResult = await window.electronAPI.agent.createSandbox(workspacePath, conversationId)

          if (createResult.success) {
            sandboxPath = createResult.path
            addExecutionLog({
              level: 'info',
              message: `🏖️ 沙箱目录已创建: ${sandboxPath}`,
            })
          } else {
            console.error('[🏖️ SANDBOX_INIT] 沙箱目录创建失败', createResult.error)
            addExecutionLog({
              level: 'warn',
              message: `🏖️ 创建沙箱目录失败: ${createResult.error}`,
            })
          }
        } else {
          // 无工作区：使用用户数据目录下的 agent-sandbox 目录
          const createResult = await window.electronAPI.agent.createDefaultSandbox(conversationId)

          if (createResult.success) {
            sandboxPath = createResult.path
            addExecutionLog({
              level: 'info',
              message: `🏖️ 沙箱目录已创建（默认）: ${sandboxPath}`,
            })
          } else {
            console.error('[🏖️ SANDBOX_INIT] 沙箱目录创建失败', createResult.error)
            addExecutionLog({
              level: 'warn',
              message: `🏖️ 创建默认沙箱目录失败: ${createResult.error}`,
            })
          }
        }
      }

      // 解析 AI 配置：如果没有指定 apiEndpoint/apiKey，尝试从全局配置获取
      let resolvedApiEndpoint = apiEndpoint
      let resolvedApiKey = apiKey
      if (!apiEndpoint || !apiKey) {
        try {
          const resolvedConfig = await resolveAIConfig()
          resolvedApiEndpoint = apiEndpoint || resolvedConfig.apiEndpoint
          resolvedApiKey = apiKey || resolvedConfig.apiKey
        } catch {
          // 全局配置未启用，使用原有值
        }
      }

      // 创建执行器
      const agentExecutor = new IntelligentAgentExecutor(
        {
          provider,
          model,
          apiEndpoint: resolvedApiEndpoint,
          apiKey: resolvedApiKey,
          workflows: availableWorkflows,
          history,  // 传递对话历史
          sandboxPath,  // 传递沙箱路径
          messages,  // 传递完整消息上下文（继续执行时使用）
        },
        {
          // 流式思考内容
          onThoughtChunk: (chunk) => {
            // 实时追加思考内容到当前步骤
            appendThoughtChunk(assistantMsgId, chunk)
          },

          // 流式推理内容（DeepSeek R1 等）
          onReasoningChunk: (chunk) => {
            // 实时追加推理内容
            appendReasoningChunk(assistantMsgId, chunk)
          },

          // 步骤开始
          onStepStart: (step: AgentStep) => {
            currentStepIdRef.current = step.id
            currentIterationRef.current = step.iteration
            appendStep(assistantMsgId, step)
            
            // 追踪思考开始
            thinkingStartTimeRef.current = Date.now()
            updateMetrics({
              nodeId: assistantMsgId,
              executionId,
              type: 'thinking_start',
              timestamp: Date.now(),
              data: { iteration: step.iteration }
            })
            
            addExecutionLog({
              level: 'info',
              message: `开始迭代 ${step.iteration}`,
            })
          },

          // 步骤更新
          onStepUpdate: (stepId: string, update: Partial<AgentStep>) => {
            updateStep(assistantMsgId, stepId, update)
          },

          // 步骤完成
          onStepComplete: (stepId: string) => {
            updateStep(assistantMsgId, stepId, {
              thoughtStreaming: false,
            })
            
            // 追踪思考结束和迭代完成
            if (thinkingStartTimeRef.current) {
              const currentMessage = useAgentStore.getState().messages.find(m => m.id === assistantMsgId)
              const currentStep = currentMessage?.steps?.find(s => s.id === stepId)
              const thought = currentStep?.thought || ''
              
              updateMetrics({
                nodeId: assistantMsgId,
                executionId,
                type: 'thinking_end',
                timestamp: Date.now(),
                data: { 
                  startTime: thinkingStartTimeRef.current,
                  thought,
                  iteration: currentIterationRef.current
                }
              })
            }
            
            updateMetrics({
              nodeId: assistantMsgId,
              executionId,
              type: 'iteration_complete',
              timestamp: Date.now(),
              data: { iteration: currentIterationRef.current }
            })
            
            // 【关键】步骤完成后立即增量保存
            saveCurrentConversationIncremental()
          },

          // 工具调用开始（单个，兼容旧模式）
          onToolCallStart: (toolCall: ToolCallRecord) => {
            // 更新当前步骤的 toolCall
            const stepId = currentStepIdRef.current
            console.log('[AgentPage] onToolCallStart', { stepId, toolCallId: toolCall.id, toolName: toolCall.toolName })
            if (stepId) {
              updateStep(assistantMsgId, stepId, { toolCall })
            }
            addExecutionLog({
              level: 'info',
              message: `调用工具: ${toolCall.toolName}`,
              details: toolCall.input,
            })
            
            // 追踪工具调用开始
            updateMetrics({
              nodeId: assistantMsgId,
              executionId,
              type: 'tool_start',
              timestamp: Date.now(),
              data: { 
                toolId: toolCall.id,
                toolName: toolCall.toolName
              }
            })
          },

          // 工具调用开始（多个并行）
          onToolCallsStart: (toolCalls: ToolCallRecord[]) => {
            const stepId = currentStepIdRef.current
            console.log('[AgentPage] onToolCallsStart', { stepId, count: toolCalls.length })
            if (stepId) {
              // 存储所有工具调用到步骤
              addToolCalls(assistantMsgId, stepId, toolCalls)
              // 添加执行日志
              toolCalls.forEach(tc => {
                addExecutionLog({
                  level: 'info',
                  message: `调用工具: ${tc.toolName}`,
                  details: tc.input,
                })
                
                // 追踪工具调用开始
                updateMetrics({
                  nodeId: assistantMsgId,
                  executionId,
                  type: 'tool_start',
                  timestamp: Date.now(),
                  data: { 
                    toolId: tc.id,
                    toolName: tc.toolName
                  }
                })
              })
            }
          },

          // 工具调用更新
          onToolCallUpdate: (toolCallId: string, update: Partial<ToolCallRecord>, index?: number) => {
            const stepId = currentStepIdRef.current
            if (stepId) {
              if (index !== undefined) {
                // 并行模式：使用索引更新
                updateToolCallByIndex(assistantMsgId, stepId, index, update)
              } else {
                // 查找工具调用位置：先检查单个 toolCall，再检查 toolCalls 数组
                const currentMessage = useAgentStore.getState().messages.find(m => m.id === assistantMsgId)
                const currentStep = currentMessage?.steps?.find(s => s.id === stepId)

                if (currentStep?.toolCall?.id === toolCallId) {
                  // 单个工具调用（旧格式）
                  updateToolCall(assistantMsgId, stepId, toolCallId, update)
                } else if (currentStep?.toolCalls) {
                  // 在 toolCalls 数组中查找并更新
                  const toolCallIndex = currentStep.toolCalls.findIndex(tc => tc.id === toolCallId)
                  if (toolCallIndex !== -1) {
                    updateToolCallByIndex(assistantMsgId, stepId, toolCallIndex, update)
                  }
                }
              }
            }
            if (update.status === 'completed') {
              addExecutionLog({
                level: 'info',
                message: `工具执行完成`,
              })
              
              // 追踪工具调用完成
              updateMetrics({
                nodeId: assistantMsgId,
                executionId,
                type: 'tool_end',
                timestamp: Date.now(),
                data: { 
                  toolId: toolCallId,
                  success: true
                }
              })
              
              // 【关键】工具执行完成后立即增量保存
              saveCurrentConversationIncremental()
            } else if (update.status === 'error') {
              addExecutionLog({
                level: 'error',
                message: `工具执行失败: ${update.error}`,
              })
              
              // 追踪工具调用失败
              updateMetrics({
                nodeId: assistantMsgId,
                executionId,
                type: 'tool_end',
                timestamp: Date.now(),
                data: { 
                  toolId: toolCallId,
                  success: false
                }
              })
            }
          },

          // 工具调用完成
          onToolCallComplete: (_toolCallId: string, result: { output?: unknown; error?: string }, _index?: number) => {
            if (result.error) {
              addExecutionLog({
                level: 'error',
                message: result.error,
              })
            }
          },

          // 任务更新
          onTodosUpdate: (items) => {
            updateTodos(items)
          },

          // 完成
          onComplete: (response, generatedFiles) => {
            console.log('[🏖️ AGENT_PAGE] onComplete 回调', {
              responseLength: response?.length,
              generatedFilesCount: generatedFiles?.length || 0,
              generatedFiles,
            })
            updateMessage(assistantMsgId, {
              content: response,
              isStreaming: false,
              responseStreaming: false,
              reasoningStreaming: false, // 停止推理流式状态
              generatedFiles,
            })
            addExecutionLog({
              level: 'info',
              message: `任务完成${generatedFiles?.length ? `，生成了 ${generatedFiles.length} 个文件` : ''}`,
            })

            // 标记执行完成
            updateMetrics({
              nodeId: assistantMsgId,
              executionId,
              type: 'execution_complete',
              timestamp: Date.now(),
              data: {}
            })
            completeExecution(assistantMsgId, true)

            // 【关键】禁用增量保存模式，恢复正常的保存逻辑
            setIncrementalSaveEnabled(false)

            // 检查所有任务是否都已完成，如果是则自动清空任务列表
            const currentTodos = useAgentStore.getState().todos.items
            if (currentTodos.length > 0 && currentTodos.every(t => t.completed)) {
              // 延迟一小段时间让用户看到完成状态后再清空
              setTimeout(() => {
                useAgentStore.getState().clearTodos()
              }, 1500)
            }
          },

          // 错误
          onError: (error) => {
            updateMessage(assistantMsgId, {
              content: `错误: ${error}`,
              isStreaming: false,
            })
            addExecutionLog({
              level: 'error',
              message: error,
            })
            
            // 标记执行失败
            updateMetrics({
              nodeId: assistantMsgId,
              executionId,
              type: 'execution_complete',
              timestamp: Date.now(),
              data: {}
            })
            completeExecution(assistantMsgId, false)
            
            // 【关键】错误时也要禁用增量保存模式
            setIncrementalSaveEnabled(false)
          },

          // 迭代限制
          onIterationLimitReached: (current, max) => {
            setIterationLimitReached(true, current, max)
            updateMessage(assistantMsgId, {
              isStreaming: false,
            })
            addExecutionLog({
              level: 'warn',
              message: `已达到最大迭代次数 (${current}/${max})，等待用户确认`,
            })
            // 【关键】达到迭代限制时也要禁用增量保存模式
            setIncrementalSaveEnabled(false)
          },
        }
      )

      // 如果是继续执行，设置继续参数
      if (continueParams) {
        agentExecutor.setContinueParams(
          continueParams.startIteration,
          continueParams.maxIterations,
          continueParams.generatedFiles
        )
      }

      // 执行
      await agentExecutor.execute(userInput, abortControllerRef.current.signal)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage !== '执行已取消') {
        updateMessage(assistantMsgId, {
          content: `执行失败: ${errorMessage}`,
          isStreaming: false,
        })
        addExecutionLog({
          level: 'error',
          message: errorMessage,
        })
      }
      // 【关键】catch 块中也要禁用增量保存模式
      setIncrementalSaveEnabled(false)
    } finally {
      setRunning(false)
    }
  }, [
    model,
    provider,
    apiEndpoint,
    apiKey,
    availableWorkflows,
    addMessage,
    updateMessage,
    setRunning,
    appendStep,
    updateStep,
    updateLastStep,
    updateTodos,
    addExecutionLog,
    setSettingsOpen,
    setIterationLimitReached,
    setIncrementalSaveEnabled,
    currentWorkspace,
    conversationHistory.currentConversationId,
    initExecution,
    updateMetrics,
    completeExecution,
  ])

  const isContinueExecutionIntent = useCallback((text: string): boolean => {
    const continueKeywords = [
      '继续执行',
      '继续',
      'continue',
      'go on',
      'keep going',
      'proceed',
    ]
    const lowerText = text.toLowerCase().trim()
    return continueKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    )
  }, [])

  const hasInterruptedExecution = useCallback((): {
    assistantMsg: AgentMessage | undefined
    lastUserMsg: AgentMessage | undefined
    lastIteration: number
  } => {
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistantMsg) return { assistantMsg: undefined, lastUserMsg: undefined, lastIteration: 0 }
    
    const steps = lastAssistantMsg.steps
    if (!steps || steps.length === 0) {
      return { assistantMsg: undefined, lastUserMsg: undefined, lastIteration: 0 }
    }
    
    const lastStep = steps[steps.length - 1]
    const isIncomplete = 
      lastAssistantMsg.isStreaming ||
      lastStep.status !== 'completed' ||
      (lastStep.toolCalls && lastStep.toolCalls.some(tc => tc.status !== 'completed' && tc.status !== 'error'))
    
    if (!isIncomplete) {
      return { assistantMsg: undefined, lastUserMsg: undefined, lastIteration: 0 }
    }
    
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    const lastIteration = steps.length
    
    return { 
      assistantMsg: lastAssistantMsg, 
      lastUserMsg, 
      lastIteration 
    }
  }, [messages])

  const handleSmartContinue = useCallback(() => {
    const { assistantMsg, lastUserMsg, lastIteration } = hasInterruptedExecution()
    if (!assistantMsg || !lastUserMsg) return false
    
    continueExecution()
    
    const newMaxIterations = useAgentStore.getState().maxIterations
    
    const existingMessages: OpenAIMessage[] = [
      { role: 'system', content: '' }
    ]
    
    if (assistantMsg.steps) {
      for (const step of assistantMsg.steps) {
        if (step.thought) {
          existingMessages.push({
            role: 'assistant',
            content: step.thought,
            tool_calls: undefined
          })
        }
        
        if (step.toolCalls && step.toolCalls.length > 0) {
          const toolCalls: Array<{
            id: string
            type: 'function'
            function: { name: string; arguments: string }
          }> = []

          for (const toolCall of step.toolCalls) {
            toolCalls.push({
              id: toolCall.id,
              type: 'function',
              function: {
                name: toolCall.toolName,
                arguments: JSON.stringify(toolCall.input)
              }
            })
          }

          // 【关键】先添加助手消息携带 tool_calls，再添加 tool 消息
          // 如果没有上一个助手消息，则创建一个空的（处理只有工具调用没有思考内容的情况）
          const lastAssistantMsg = existingMessages[existingMessages.length - 1]
          if (lastAssistantMsg && lastAssistantMsg.role === 'assistant') {
            lastAssistantMsg.tool_calls = toolCalls
          } else {
            existingMessages.push({
              role: 'assistant',
              content: '',
              tool_calls: toolCalls
            })
          }

          // 然后再添加工具响应
          for (const toolCall of step.toolCalls) {
            existingMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: String(toolCall.output || toolCall.error || '')
            })
          }
        }
      }
    }

    const msgIndex = messages.indexOf(lastUserMsg)
    executeAgent(
      lastUserMsg.content,
      messages.slice(0, msgIndex),
      {
        startIteration: lastIteration,
        maxIterations: newMaxIterations,
        assistantMsgId: assistantMsg.id,
        existingMessages,
        generatedFiles: assistantMsg.generatedFiles
      }
    )
    
    return true
  }, [messages, executeAgent, continueExecution, hasInterruptedExecution])

  const handleSend = useCallback(() => {
    if (!input.trim() || isRunning) return
    const userInput = input.trim()
    setInput('')
    
    if (isContinueExecutionIntent(userInput)) {
      const continued = handleSmartContinue()
      if (continued) return
    }
    
    executeAgent(userInput, messages)
  }, [input, isRunning, messages, executeAgent, isContinueExecutionIntent, handleSmartContinue])

  // 重试（重新生成）
  const handleRetry = useCallback((assistantMsgId: string) => {
    if (isRunning) return
    // 找到该助手消息之前的用户消息
    const msgIndex = messages.findIndex(m => m.id === assistantMsgId)
    if (msgIndex > 0) {
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          const userInput = messages[i].content
          // 删除该用户消息及其后面的所有消息
          deleteMessagesAfter(messages[i].id)
          // 重新发送
          executeAgent(userInput, messages.slice(0, i))
          break
        }
      }
    }
  }, [isRunning, messages, deleteMessagesAfter, executeAgent])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    setRunning(false)
    setFeedback('已停止执行')
    setTimeout(() => setFeedback(null), 2000)
  }, [setRunning])

  // 处理继续执行
  const handleContinueExecution = useCallback(() => {
    continueExecution()

    // 找到最后一个助手消息（当前执行暂停的消息）
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop()
    if (!lastAssistantMessage) return

    // 获取新的最大迭代次数
    const newMaxIterations = useAgentStore.getState().maxIterations

    // 构建之前的执行上下文（包括工具调用结果）
    const existingMessages: OpenAIMessage[] = [
      { role: 'system', content: '' }  // 占位，会被执行器覆盖
    ]

    // 遍历助手消息的步骤，构建完整的上下文
    if (lastAssistantMessage.steps) {
      let lastThought = ''
      for (const step of lastAssistantMessage.steps) {
        // 添加助手思考消息
        if (step.thought) {
          lastThought = step.thought
          existingMessages.push({
            role: 'assistant',
            content: lastThought,
            tool_calls: undefined
          })
        }

        // 添加工具调用及其结果
        if (step.toolCalls) {
          const toolCalls: Array<{
            id: string
            type: 'function'
            function: { name: string; arguments: string }
          }> = []

          for (const toolCall of step.toolCalls) {
            toolCalls.push({
              id: toolCall.id,
              type: 'function',
              function: {
                name: toolCall.toolName,
                arguments: JSON.stringify(toolCall.input)
              }
            })
          }

          // 【关键】先添加助手消息携带 tool_calls，再添加 tool 消息
          // 如果没有上一个助手消息，则创建一个空的（处理只有工具调用没有思考内容的情况）
          // 否则 OpenAI API 会报错：tool 消息必须紧跟在有 tool_calls 的 assistant 消息之后
          const lastAssistantMsg = existingMessages[existingMessages.length - 1]
          if (lastAssistantMsg && lastAssistantMsg.role === 'assistant') {
            lastAssistantMsg.tool_calls = toolCalls
          } else {
            existingMessages.push({
              role: 'assistant',
              content: '',
              tool_calls: toolCalls
            })
          }

          // 然后再添加工具响应
          for (const toolCall of step.toolCalls) {
            existingMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: String(toolCall.output || toolCall.error || '')
            })
          }
        }
      }
    }

    // 重新执行最后一个用户消息，带上继续执行的参数
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    if (lastUserMessage) {
      const msgIndex = messages.indexOf(lastUserMessage)
      executeAgent(
        lastUserMessage.content,
        messages.slice(0, msgIndex),
        {
          startIteration: currentIteration,
          maxIterations: newMaxIterations,
          assistantMsgId: lastAssistantMessage.id,
          existingMessages,
          generatedFiles: lastAssistantMessage.generatedFiles
        }
      )
    }
  }, [messages, executeAgent, continueExecution, currentIteration])

  // 处理停止执行（在迭代限制提示中）
  const handleStopExecution = useCallback(() => {
    clearIterationLimit()
    setFeedback('已停止执行')
    setTimeout(() => setFeedback(null), 2000)
  }, [clearIterationLimit])

  // Platform detection
  const isMac = useMemo(() => window.electronAPI.platform.isMac(), [])

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] overflow-hidden">
      <AnimatedBackground />

      {/* macOS style drag region */}
      {isMac && (
        <div
          className="fixed top-0 left-0 w-[72px] h-14 pointer-events-none"
          style={{ WebkitAppRegion: 'drag', zIndex: 9999 } as React.CSSProperties}
        />
      )}

      {/* AppHeader */}
      <AppHeader
        page="agent"
        onClose={handleBack}
        onSettings={() => setSettingsOpen(true)}
        onToggleLogs={() => setShowLogsPanel(!showLogsPanel)}
        showLogsPanel={showLogsPanel}
        isRunning={isRunning}
        conversationTitle={currentConversationTitle || undefined}
      />

      {/* Main content */}
      <div className="fixed inset-0 top-14 flex overflow-hidden" style={{ zIndex: 1 }}>
        {/* 左侧：聊天历史侧边栏 */}
        <motion.div
          initial={{ width: 240, opacity: 1 }}
          animate={{ width: 240, opacity: 1 }}
          className="h-full flex-shrink-0"
        >
          <AgentSidebar />
        </motion.div>

        {/* 中间：主聊天区域 */}
        <motion.div
          className="h-full overflow-hidden relative flex flex-col"
          layout
          animate={{
            width: showLogsPanel ? 'calc(100% - 240px - 320px)' : 'calc(100% - 240px)'
          }}
          transition={{
            duration: 0.25,
            ease: [0.4, 0, 0.2, 1] // Material Design 标准缓动
          }}
        >
          {/* 消息区域 */}
          <main ref={messagesContainerRef} className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4">
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  {/* 顶部图标和标题组合 */}
                  <div className="flex items-center gap-3 mb-4">
                    <motion.div
                      className="w-12 h-12 rounded-xl glass-panel flex items-center justify-center"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Sparkles className="w-6 h-6 text-blue-400" />
                    </motion.div>
                    <h2 className="text-xl font-semibold">欢迎使用智能助手</h2>
                  </div>

                  <p className="text-sm text-[var(--color-text-muted)] text-center max-w-md mb-6">
                    {availableWorkflows.length > 0
                      ? `已发现 ${availableWorkflows.length} 个可用工作流，可以直接向我提问`
                      : '请在设置中配置模型后开始对话'}
                  </p>

                  {/* 可用工作流列表 - 网格布局 */}
                  {availableWorkflows.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                      {availableWorkflows.slice(0, 4).map((w) => (
                        <div
                          key={w.workspacePath}
                          className="px-3 py-2 rounded-lg glass-panel text-xs text-center truncate"
                          title={w.name}
                        >
                          {w.name}
                        </div>
                      ))}
                      {availableWorkflows.length > 4 && (
                        <div className="px-3 py-2 rounded-lg glass-panel text-xs text-center text-[var(--color-text-muted)] col-span-2">
                          还有 {availableWorkflows.length - 4} 个工作流可用
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* 消息列表 */}
              {messages.map((msg, index) => (
                <AgentMessageBlock
                  key={msg.id}
                  message={msg}
                  isLast={index === messages.length - 1}
                  isRunning={isRunning}
                  onRetry={() => handleRetry(msg.id)}
                  onDelete={() => {
                    if (confirm('确定要删除这条消息吗？')) {
                      deleteMessage(msg.id)
                    }
                  }}
                  onEdit={(newContent) => {
                    // 找到该消息在列表中的索引
                    const msgIndex = messages.findIndex(m => m.id === msg.id)
                    // 更新用户消息内容
                    updateMessage(msg.id, { content: newContent })
                    // 删除该消息后面的所有消息
                    deleteMessagesAfter(msg.id)
                    // 自动重新执行
                    executeAgent(newContent, messages.slice(0, msgIndex))
                  }}
                />
              ))}

              {/* 迭代限制提示 */}
              <AnimatePresence>
                {iterationLimitReached && (
                  <AgentIterationLimitPrompt
                    currentIteration={currentIteration}
                    onContinue={handleContinueExecution}
                    onStop={handleStopExecution}
                  />
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* 输入区域 - 固定在底部 */}
          <div className="flex-shrink-0 p-4 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/95 to-transparent relative z-10">
            <div className="max-w-3xl mx-auto">
              {/* 内联任务列表 */}
              <AgentInlineTodos todos={todos.items} isRunning={isRunning} />

              {/* 生成的文件列表 - 聚合所有消息中的生成文件 */}
              <AgentInlineGeneratedFiles messages={messages} />

              {/* 状态栏 */}
              <div className="flex items-center justify-between mb-2 px-1 text-xs text-[var(--color-text-muted)]">
                <span>
                  {model ? (
                    <span className="flex items-center gap-1.5">
                      <span className={cn(
                        'w-2 h-2 rounded-full',
                        provider === 'ollama' ? 'bg-green-400' : 'bg-blue-400'
                      )} />
                      {provider === 'ollama' ? 'Ollama' : 'OpenAI'}: {model}
                    </span>
                  ) : (
                    <span className="text-yellow-400">未选择模型</span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <button
                    onClick={() => setShowExecutionHistory(true)}
                    className="flex items-center gap-1 hover:text-[var(--color-text)] transition-colors"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    执行分析
                  </button>
                  {availableWorkflows.length > 0 && (
                    <span>{availableWorkflows.length} 个工作流可用</span>
                  )}
                </span>
              </div>

              {/* 输入框 */}
              <ChatInput
                input={input}
                setInput={setInput}
                onSend={handleSend}
                onStop={handleStop}
                isRunning={isRunning}
                disabled={!model}
                autoFocus
              />
            </div>
          </div>
        </motion.div>

        {/* 右侧：日志面板 */}
        <AgentSidePanel
          visible={showLogsPanel}
          onClose={() => setShowLogsPanel(false)}
        />
      </div>

      {/* 设置面板 */}
      <AgentSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* 执行历史面板 */}
      <AgentExecutionHistoryPanel
        isOpen={showExecutionHistory}
        onClose={() => setShowExecutionHistory(false)}
      />

      {/* 子工作流用户输入管理 */}
      <AgentQuestionsManager />

      {/* 反馈提示 */}
      <AnimatePresence>
        {feedback && <AgentFeedback message={feedback} />}
      </AnimatePresence>
    </div>
  )
}
