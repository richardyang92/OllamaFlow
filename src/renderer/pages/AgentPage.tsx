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
} from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useAgentStore } from '@/store/agent-store'
import type { AgentStep, ToolCallRecord, AgentMessage } from '@/store/agent-store'
import { IntelligentAgentExecutor } from '@/engine/agent-executor'
import { resolveAIConfig } from '@/engine/config-resolver'
import { cn } from '@/lib/utils'
import {
  AgentMessageBlock,
  AgentSettingsPanel,
  AgentQuestionsManager,
  AgentInlineTodos,
  AgentInlineGeneratedFiles,
  AgentSidePanel,
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
}: {
  input: string
  setInput: (v: string) => void
  onSend: () => void
  onStop: () => void
  isRunning: boolean
  disabled: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  return (
    <div className="glass-panel rounded-2xl p-3">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入您的问题..."
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent',
            'text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)]',
            'focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        />

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
              'bg-gradient-to-r from-purple-500/60 to-blue-500/60 text-white',
              'hover:from-purple-500/80 hover:to-blue-500/80',
              'hover:shadow-lg hover:shadow-purple-500/25',
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
    // 新增
    showSubAgentDetailsPanel,
    todos,
    setSettingsOpen,
    setShowLogsPanel,
    // 新增
    setShowSubAgentDetailsPanel,
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
    updateSubAgentProgress,
    addSubAgentLog,
    updateToolCall,
    addToolCalls,
    updateToolCallByIndex,
    addTimelineEvent,
    addNodeStep,
    updateNodeStep,
    // 对话历史
    conversationHistory,
    isHistoryLoaded,
    createConversation,
    loadConversationHistory,
    saveCurrentConversation,
    updateCurrentConversationMeta,
  } = useAgentStore()

  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentStepIdRef = useRef<string | null>(null)

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

  // 自动保存当前对话
  useEffect(() => {
    if (messages.length > 0 && conversationHistory.currentConversationId) {
      updateCurrentConversationMeta()
      const timer = setTimeout(() => {
        saveCurrentConversation()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [messages, conversationHistory.currentConversationId, updateCurrentConversationMeta, saveCurrentConversation])

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
  const executeAgent = useCallback(async (userInput: string, historyMessages: AgentMessage[]) => {
    if (!model) {
      setFeedback('请先在设置中选择模型')
      setTimeout(() => setFeedback(null), 2000)
      setSettingsOpen(true)
      return
    }

    // 添加用户消息
    addMessage({ role: 'user', content: userInput })

    // 创建助手消息占位
    const assistantMsgId = addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true,
    })

    setRunning(true)
    abortControllerRef.current = new AbortController()

    // 构建历史消息上下文
    const history = historyMessages.map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      // 获取流式追加方法
      const { appendThoughtChunk, appendReasoningChunk } = useAgentStore.getState()

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
            appendStep(assistantMsgId, step)
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
                // 兼容旧模式：使用 toolCallId 更新
                const currentMessage = useAgentStore.getState().messages.find(m => m.id === assistantMsgId)
                const currentStep = currentMessage?.steps?.find(s => s.id === stepId)
                if (currentStep?.toolCall?.id === toolCallId) {
                  updateToolCall(assistantMsgId, stepId, toolCallId, update)
                }
              }
            }
            if (update.status === 'completed') {
              addExecutionLog({
                level: 'info',
                message: `工具执行完成`,
              })
            } else if (update.status === 'error') {
              addExecutionLog({
                level: 'error',
                message: `工具执行失败: ${update.error}`,
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

          // SubAgent 进度更新
          onSubAgentProgress: (toolCallId: string, progress) => {
            // 使用当前步骤 ID
            const stepId = currentStepIdRef.current
            if (stepId) {
              updateSubAgentProgress(assistantMsgId, stepId, toolCallId, progress)
            }
          },

          // SubAgent 日志
          onSubAgentLog: (toolCallId: string, logEntry) => {
            // 使用当前步骤 ID
            const stepId = currentStepIdRef.current
            if (stepId) {
              addSubAgentLog(assistantMsgId, stepId, toolCallId, logEntry)
            }
          },

          // 时间线事件（新增）
          onSubAgentTimelineEvent: (toolCallId: string, event) => {
            const stepId = currentStepIdRef.current
            if (stepId) {
              addTimelineEvent(assistantMsgId, stepId, toolCallId, event)
            }
          },

          // 节点步骤回调（新增）
          onSubAgentNodeStep: (toolCallId: string, nodeStep) => {
            const stepId = currentStepIdRef.current
            if (stepId) {
              addNodeStep(assistantMsgId, stepId, toolCallId, nodeStep)
            }
          },

          onSubAgentNodeStepUpdate: (toolCallId: string, nodeId: string, update) => {
            const stepId = currentStepIdRef.current
            if (stepId) {
              updateNodeStep(assistantMsgId, stepId, toolCallId, nodeId, update)
            }
          },

          // 节点流式更新（新增）
          onSubAgentStreamUpdate: (toolCallId: string, nodeId: string, nodeName: string, update) => {
            const stepId = currentStepIdRef.current
            if (stepId) {
              // 为流式更新创建或更新时间线事件
              if (update.reasoningChunk) {
                // 使用特定的 event ID 来标识这个节点的思考流
                const eventId = `thinking_${nodeId}`
                addTimelineEvent(assistantMsgId, stepId, toolCallId, {
                  id: eventId,
                  nodeId,
                  nodeName,
                  nodeType: 'reactAgent', // 默认为 reactAgent，实际应根据节点类型
                  eventType: 'thinking_stream',
                  timestamp: Date.now(),
                  data: {
                    reasoning: update.reasoningChunk,
                    reasoningStreaming: true,
                  },
                })
              }
              if (update.outputChunk) {
                const eventId = `output_${nodeId}`
                addTimelineEvent(assistantMsgId, stepId, toolCallId, {
                  id: eventId,
                  nodeId,
                  nodeName,
                  nodeType: 'ollamaChat',
                  eventType: 'output_stream',
                  timestamp: Date.now(),
                  data: {
                    output: update.outputChunk,
                    outputStreaming: true,
                  },
                })
              }
              if (update.toolUpdate) {
                const eventId = `tool_${nodeId}_${Date.now()}`
                addTimelineEvent(assistantMsgId, stepId, toolCallId, {
                  id: eventId,
                  nodeId,
                  nodeName,
                  nodeType: 'reactAgent',
                  eventType: 'tool_call_complete',
                  timestamp: Date.now(),
                  data: {
                    toolCall: {
                      toolName: update.toolUpdate.toolName,
                      input: null,
                      output: update.toolUpdate.output,
                      error: update.toolUpdate.error,
                    },
                  },
                })
              }
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
          },
        }
      )

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
    currentWorkspace,
    conversationHistory.currentConversationId,
  ])

  // 发送消息（从输入框）
  const handleSend = useCallback(() => {
    if (!input.trim() || isRunning) return
    const userInput = input.trim()
    setInput('')
    executeAgent(userInput, messages)
  }, [input, isRunning, messages, executeAgent])

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

  // Platform detection
  const isMac = useMemo(() => window.electronAPI.platform.isMac(), [])

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] overflow-hidden">
      <AnimatedBackground />

      {/* macOS style drag region */}
      {isMac && (
        <div
          className="fixed top-0 left-0 w-[72px] h-14 z-30"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
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
      />

      {/* Main content */}
      <div className="fixed inset-0 top-14 flex overflow-hidden">
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
                      <Sparkles className="w-6 h-6 text-purple-400" />
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

              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* 输入区域 - 固定在底部 */}
          <div className="flex-shrink-0 p-4 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/95 to-transparent">
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
                <span>
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
              />
            </div>
          </div>
        </motion.div>

        {/* 右侧：Tab 面板（日志和 SubAgent） */}
        <AgentSidePanel
          visible={showLogsPanel}
          activeTab={showSubAgentDetailsPanel ? 'subagent' : 'logs'}
          onTabChange={(tab) => {
            if (tab === 'subagent') {
              setShowSubAgentDetailsPanel(true)
            } else {
              setShowSubAgentDetailsPanel(false)
            }
          }}
          onClose={() => setShowLogsPanel(false)}
        />
      </div>

      {/* 设置面板 */}
      <AgentSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
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
