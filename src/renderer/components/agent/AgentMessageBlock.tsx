/**
 * Agent 消息块组件 - 平铺式设计
 * 展示单条消息，思考、工具调用、回复都平铺在聊天流中
 */

import { memo, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Bot, Loader2, RotateCcw, Trash2, Pencil, Check, X, Copy, ChevronDown, FileText, Terminal, Globe, Calendar, Cog, Brain, Eye, CheckCircle2, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentMessage, ToolCallRecord } from '@/store/agent-store'
import AgentMarkdown from './AgentMarkdown'
import StreamingFlashText from '@/components/nodes/shared/StreamingFlashText'

function formatTimestamp(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`

  const date = new Date(timestamp)
  const today = new Date(now)

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }

  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

interface AgentMessageBlockProps {
  message: AgentMessage
  onRetry?: () => void
  onDelete?: () => void
  onEdit?: (newContent: string) => void
  isLast?: boolean
  isRunning?: boolean
  className?: string
}

function StreamingCursor() {
  return <span className="inline-block w-0.5 h-4 ml-0.5 bg-blue-400 animate-pulse" />
}

function MessageActionButton({
  icon: Icon,
  onClick,
  tooltip,
  destructive = false,
}: {
  icon: typeof RotateCcw
  onClick: () => void
  tooltip: string
  destructive?: boolean
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'p-1.5 rounded-md transition-all duration-200',
        'opacity-0 group-hover:opacity-100',
        destructive
          ? 'hover:bg-red-500/10 hover:text-red-400 text-[var(--color-text-muted)]'
          : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
      )}
      title={tooltip}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}

function UserMessage({
  content,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  timestamp,
}: {
  content: string
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (newContent: string) => void
  onDelete: () => void
  timestamp: number
}) {
  const [editContent, setEditContent] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(content.length, content.length)
    }
  }, [isEditing, content])

  useEffect(() => {
    setEditContent(content)
  }, [content])

  const handleSave = () => {
    const trimmed = editContent.trim()
    if (trimmed && trimmed !== content) {
      onSaveEdit(trimmed)
    } else {
      onCancelEdit()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      onCancelEdit()
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
  }

  return (
    <div className="flex gap-3 group">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
        <User className="w-4 h-4 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-xs text-[var(--color-text-muted)]">你</div>
          <div className="text-xs text-[var(--color-text-muted)]">·</div>
          <div className="text-xs text-[var(--color-text-muted)]">{formatTimestamp(timestamp)}</div>
          <div className="flex items-center gap-0.5 ml-auto">
            {isEditing ? (
              <>
                <button onClick={handleSave} className="p-1.5 rounded-md hover:bg-green-500/10 text-green-400 transition-colors" title="保存">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={onCancelEdit} className="p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors" title="取消">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <MessageActionButton icon={Copy} onClick={handleCopy} tooltip="复制消息" />
                <MessageActionButton icon={Pencil} onClick={onStartEdit} tooltip="编辑消息" />
                <MessageActionButton icon={Trash2} onClick={onDelete} tooltip="删除消息" destructive />
              </>
            )}
          </div>
        </div>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 text-sm bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-[var(--color-text)]"
            rows={3}
          />
        ) : (
          <div className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{content}</div>
        )}
      </div>
    </div>
  )
}

function ToolIcon({ toolName }: { toolName: string }) {
  if (toolName.startsWith('workflow_')) return <Cog className="w-3.5 h-3.5 text-blue-400" />
  switch (toolName) {
    case 'readFile':
    case 'writeFile':
      return <FileText className="w-3.5 h-3.5 text-amber-400" />
    case 'executeCommand':
      return <Terminal className="w-3.5 h-3.5 text-green-400" />
    case 'httpRequest':
      return <Globe className="w-3.5 h-3.5 text-blue-400" />
    case 'getCurrentDate':
      return <Calendar className="w-3.5 h-3.5 text-cyan-400" />
    case 'todos':
      return null
    default:
      return <Cog className="w-3.5 h-3.5 text-gray-400" />
  }
}

function ToolCallCard({ toolCall }: { toolCall: ToolCallRecord }) {
  const isWorkflow = toolCall.toolName.startsWith('workflow_')
  const [expanded, setExpanded] = useState(isWorkflow)

  // 获取工作流名称
  const workflowName = isWorkflow
    ? (toolCall.subAgentProgress?.workflowName || toolCall.metadata?.workflowPath?.split('/').pop() || toolCall.toolName)
    : null

  // 解析输入 - 对于 workflow 提取 input 字段
  const inputData = typeof toolCall.input === 'string'
    ? (() => { try { return JSON.parse(toolCall.input) } catch { return { raw: toolCall.input } } })()
    : toolCall.input

  const inputPreview = isWorkflow && inputData?.input
    ? String(inputData.input).slice(0, 80)
    : (typeof toolCall.input === 'string' ? toolCall.input : JSON.stringify(toolCall.input)).slice(0, 80)

  let extractedContent = ''

  const parseOutput = (data: unknown): string => {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data)
        return parseOutput(parsed)
      } catch {
        return data
      }
    }

    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>

      if (obj.output !== undefined && obj.workflowName !== undefined) {
        return parseOutput(obj.output)
      }

      const value = obj.data ?? obj.result ?? obj.output ?? obj.content ?? obj.message
      if (value !== undefined) {
        return parseOutput(value)
      }

      return JSON.stringify(obj, null, 2)
    }

    return String(data ?? '')
  }

  extractedContent = parseOutput(toolCall.output)

  const showOutput = toolCall.status === 'completed' && toolCall.output !== undefined

  // Workflow 特殊渲染
  if (isWorkflow) {
    const progress = toolCall.subAgentProgress
    const isRunning = toolCall.status === 'running'
    const totalNodes = progress?.totalNodes || 0
    const completedNodes = progress?.completedNodes || 0
    const progressPercent = totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-lg border overflow-hidden mb-2',
          toolCall.status === 'running' && 'border-blue-500/30 bg-blue-500/5',
          toolCall.status === 'completed' && 'border-green-500/30 bg-green-500/5',
          toolCall.status === 'error' && 'border-red-500/30 bg-red-500/5',
          toolCall.status === 'pending' && 'border-gray-500/20 bg-gray-500/5'
        )}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[var(--color-bg-hover)]/50 transition-colors"
        >
          {toolCall.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
          {toolCall.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
          {toolCall.status === 'error' && <X className="w-3.5 h-3.5 text-red-400" />}
          {toolCall.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-gray-400" />}
          <Workflow className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-sm font-medium text-[var(--color-text)]">{workflowName}</span>

          {isRunning && progress?.currentNode && (
            <span className="text-xs text-blue-400 truncate flex-1 text-left ml-2">
              {progress.currentNode}
            </span>
          )}

          {isRunning && totalNodes > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {completedNodes}/{totalNodes}
            </span>
          )}

          <ChevronDown className={cn('w-4 h-4 text-[var(--color-text-muted)] transition-transform', expanded && 'rotate-180')} />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-2">
                {inputData?.input && (
                  <div className="bg-[var(--color-bg-input)] rounded p-2 text-xs">
                    <div className="text-[var(--color-text-muted)] mb-1 text-[10px] uppercase">输入</div>
                    <div className="text-[var(--color-text)] whitespace-pre-wrap">
                      {typeof inputData.input === 'string' ? inputData.input : JSON.stringify(inputData.input, null, 2)}
                    </div>
                  </div>
                )}

                {isRunning && (
                  <div className="bg-blue-500/5 rounded p-2 text-xs border border-blue-500/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-blue-600 dark:text-blue-400 text-[10px] uppercase">执行进度</span>
                      {progress?.currentNode && (
                        <span className="text-[var(--color-text)] text-xs">
                          当前: {progress.currentNode}
                        </span>
                      )}
                    </div>

                    {totalNodes > 0 && (
                      <div className="w-full h-1.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden mb-2">
                        <motion.div
                          className="h-full bg-blue-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}

                    {progress?.reactAgentSteps && progress.reactAgentSteps.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-blue-500/10 pt-2">
                        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">
                          ReAct 步骤 {progress.reactAgentIteration}/{progress.reactAgentMaxIterations || '?'}
                        </div>
                        {progress.reactAgentSteps.map((step, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'flex items-center gap-2 text-xs',
                              step.status === 'completed' && 'text-green-600',
                              step.status === 'error' && 'text-red-400',
                              step.status === 'thinking' && 'text-amber-500',
                              step.status === 'acting' && 'text-blue-400'
                            )}
                          >
                            <span className="text-[10px] text-[var(--color-text-muted)]">{step.iteration}.</span>
                            <span className="truncate flex-1">{step.thought?.slice(0, 60)}...</span>
                            <span className="text-[10px] capitalize">{step.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {showOutput && extractedContent && (
                  <div className="bg-green-500/5 rounded p-2 text-xs border border-green-500/10">
                    <div className="text-green-600 dark:text-green-400 mb-1 text-[10px] uppercase">执行结果</div>
                    <div className="text-[var(--color-text)]">
                      <AgentMarkdown content={extractedContent} />
                    </div>
                  </div>
                )}

                {toolCall.error && (
                  <div className="bg-red-500/10 rounded p-2 text-xs border border-red-500/20">
                    <div className="text-red-400 mb-1 text-[10px] uppercase">错误</div>
                    <pre className="text-red-300 whitespace-pre-wrap font-mono">{toolCall.error}</pre>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // 普通工具渲染
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border overflow-hidden mb-2',
        toolCall.status === 'running' && 'border-blue-500/30 bg-blue-500/5',
        toolCall.status === 'completed' && 'border-green-500/30 bg-green-500/5',
        toolCall.status === 'error' && 'border-red-500/30 bg-red-500/5',
        toolCall.status === 'pending' && 'border-gray-500/20 bg-gray-500/5'
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[var(--color-bg-hover)]/50 transition-colors"
      >
        {toolCall.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
        {toolCall.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
        {toolCall.status === 'error' && <X className="w-3.5 h-3.5 text-red-400" />}
        {toolCall.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-gray-400" />}
        <ToolIcon toolName={toolCall.toolName} />
        <span className="text-sm font-mono text-[var(--color-text)]">{toolCall.toolName}</span>
        <span className="text-xs text-[var(--color-text-muted)] truncate flex-1 text-left ml-2">
          {inputPreview}...
        </span>
        <ChevronDown className={cn('w-4 h-4 text-[var(--color-text-muted)] transition-transform', expanded && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              <div className="bg-[var(--color-bg-input)] rounded p-2 text-xs">
                <div className="text-[var(--color-text-muted)] mb-1 text-[10px] uppercase">输入</div>
                <pre className="text-[var(--color-text)] whitespace-pre-wrap font-mono">
                  {typeof toolCall.input === 'string' ? toolCall.input : JSON.stringify(toolCall.input, null, 2)}
                </pre>
              </div>
              {showOutput && (
                <div className="bg-[var(--color-bg-hover)] rounded p-2 text-xs">
                  <div className="text-green-600 dark:text-green-400 mb-1 text-[10px] uppercase">输出</div>
                  <div className="text-[var(--color-text)] max-h-40 overflow-y-auto">
                    <AgentMarkdown content={typeof toolCall.output === 'string' ? toolCall.output : JSON.stringify(toolCall.output, null, 2)} />
                  </div>
                </div>
              )}
              {toolCall.error && (
                <div className="bg-red-500/10 rounded p-2 text-xs border border-red-500/20">
                  <div className="text-red-400 mb-1 text-[10px] uppercase">错误</div>
                  <pre className="text-red-300 whitespace-pre-wrap font-mono">{toolCall.error}</pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ThoughtBlock({ thought, isStreaming }: { thought: string; isStreaming?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3"
    >
      <div className="flex items-start gap-2">
        <Brain className={cn('w-4 h-4 text-amber-500 mt-1 shrink-0', isStreaming && 'animate-pulse')} />
        <div className="flex-1 min-w-0 text-sm text-[var(--color-text)]">
          {isStreaming ? (
            <div className="whitespace-pre-wrap">
              {thought}
              <StreamingCursor />
            </div>
          ) : (
            <AgentMarkdown content={thought} />
          )}
        </div>
      </div>
    </motion.div>
  )
}

function ObservationBlock({ observation }: { observation: string }) {
  const isJson = observation.trim().startsWith('{') || observation.trim().startsWith('[')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-2"
    >
      <div className="flex items-center gap-2 mb-1">
        <Eye className="w-3.5 h-3.5 text-cyan-500" />
        <span className="text-xs text-cyan-600 dark:text-cyan-400">观察结果</span>
      </div>
      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 border border-[var(--color-border-subtle)]">
        {isJson ? (
          <AgentMarkdown content={`\`\`\`json\n${observation}\n\`\`\``} />
        ) : (
          <pre className="text-sm text-[var(--color-text)] whitespace-pre-wrap font-mono">{observation}</pre>
        )}
      </div>
    </motion.div>
  )
}

function AssistantMessage({
  message,
  onRetry,
  onDelete,
  isLast,
  isRunning,
}: {
  message: AgentMessage
  onRetry?: () => void
  onDelete?: () => void
  isLast?: boolean
  isRunning?: boolean
}) {
  const hasSteps = message.steps && message.steps.length > 0
  const hasContent = message.content && message.content.trim().length > 0
  const isStreaming = message.isStreaming
  const responseStreaming = message.responseStreaming
  const hasReasoningContent = message.reasoningContent && message.reasoningContent.trim().length > 0
  const reasoningStreaming = message.reasoningStreaming

  const lastStep = hasSteps ? message.steps![message.steps!.length - 1] : null
  const lastThought = lastStep?.thought?.trim() || ''
  const contentTrimmed = message.content?.trim() || ''
  const isOutputDuplicateOfThought = lastThought && (
    contentTrimmed.includes(lastThought.substring(0, 50)) ||
    lastThought.includes(contentTrimmed.substring(0, 50))
  )

  const showActions = !isStreaming && !responseStreaming && !isRunning

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
  }

  return (
    <div className="flex gap-3 group">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
        <Bot className="w-4 h-4 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-2">
          <span>助手</span>
          <span className="mx-1">·</span>
          <span>{formatTimestamp(message.timestamp)}</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>处理中...</span>
            </span>
          )}
          {showActions && (
            <div className="flex items-center gap-0.5 ml-auto">
              <MessageActionButton icon={Copy} onClick={handleCopy} tooltip="复制消息" />
              {isLast && onRetry && <MessageActionButton icon={RotateCcw} onClick={onRetry} tooltip="重新生成" />}
              {onDelete && <MessageActionButton icon={Trash2} onClick={onDelete} tooltip="删除消息" destructive />}
            </div>
          )}
        </div>

        {/* 推理内容快闪展示 */}
        {(reasoningStreaming || hasReasoningContent) && isStreaming && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden"
          >
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">🧠</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">推理中</span>
                {reasoningStreaming && (
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-[10px] text-amber-600/60"
                  >
                    ●
                  </motion.span>
                )}
              </div>
              <StreamingFlashText
                text={message.reasoningContent || ''}
                isStreaming={reasoningStreaming || false}
                maxLength={reasoningStreaming ? 60 : 100}
                textColor="text-amber-700 dark:text-amber-300"
              />
            </div>
          </motion.div>
        )}

        {/* 平铺展示思考步骤和工具调用 */}
        {hasSteps && (
          <div className="space-y-2 mb-3">
            {message.steps!.map((step) => (
              <div key={step.id}>
                {step.thought && (
                  <ThoughtBlock
                    thought={step.thought}
                    isStreaming={step.thoughtStreaming}
                  />
                )}

                {step.toolCalls && step.toolCalls.length > 0 && (
                  <div className="space-y-1">
                    {step.toolCalls
                      .filter((toolCall) => toolCall.toolName !== 'todos')
                      .map((toolCall) => (
                        <ToolCallCard key={toolCall.id} toolCall={toolCall} />
                      ))}
                  </div>
                )}

                {step.toolCall && !step.toolCalls && step.toolCall.toolName !== 'todos' && (
                  <ToolCallCard toolCall={step.toolCall} />
                )}

                {step.observation && (
                  () => {
                    const observationTrimmed = step.observation.trim()
                    const contentTrimmed = message.content?.trim() || ''
                    const isDuplicate = contentTrimmed.includes(observationTrimmed) ||
                                        observationTrimmed.includes(contentTrimmed.substring(0, 100))
                    if (isDuplicate) return null
                    return <ObservationBlock observation={step.observation} />
                  }
                )()}
              </div>
            ))}
          </div>
        )}

        {/* 最终回复 */}
        {(hasContent || responseStreaming) && !isOutputDuplicateOfThought && (
          <div className="bg-[var(--color-bg-elevated)] rounded-lg p-3 border border-[var(--color-border-subtle)]">
            {responseStreaming ? (
              <div className="whitespace-pre-wrap text-sm text-[var(--color-text)]">
                {message.content}
                <StreamingCursor />
              </div>
            ) : (
              <AgentMarkdown content={message.content} />
            )}
          </div>
        )}

        {/* 等待状态 */}
        {isStreaming && !hasSteps && !hasContent && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>正在处理...</span>
          </div>
        )}
      </div>
    </div>
  )
}

export const AgentMessageBlock = memo(function AgentMessageBlock({
  message,
  onRetry,
  onDelete,
  onEdit,
  isLast,
  isRunning,
  className,
}: AgentMessageBlockProps) {
  const isUser = message.role === 'user'
  const [isEditing, setIsEditing] = useState(false)

  const handleStartEdit = () => setIsEditing(true)
  const handleCancelEdit = () => setIsEditing(false)
  const handleSaveEdit = (newContent: string) => {
    onEdit?.(newContent)
    setIsEditing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('py-4', className)}
    >
      {isUser ? (
        <UserMessage
          content={message.content}
          isEditing={isEditing}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={handleSaveEdit}
          onDelete={() => onDelete?.()}
          timestamp={message.timestamp}
        />
      ) : (
        <AssistantMessage
          message={message}
          onRetry={onRetry}
          onDelete={onDelete}
          isLast={isLast}
          isRunning={isRunning}
        />
      )}
    </motion.div>
  )
})

export default AgentMessageBlock
