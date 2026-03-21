/**
 * AgentStepBlock – redesigned modern visualization for a single execution step.
 * This component keeps the same public props, but renders a much richer, card-based UI
 * with a left vertical timeline, animated state dots, and rich previews for thoughts,
 * tool calls and observations. Completed steps collapse into a compact summary with an
 * expandable history. Dark mode is preserved via Tailwind utility tokens.
 */

import { useState, useEffect, memo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Wrench,
  Eye,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  FileText,
  Terminal,
  Globe,
  Calendar,
  Cog,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentStep, ReActStepDetail } from '@/store/agent-store'
import AgentMarkdown from './AgentMarkdown'

interface AgentStepBlockProps {
  step: AgentStep
  isLast?: boolean
  defaultExpanded?: boolean
  forceCollapsed?: boolean  // 强制收起（执行完成时）
  className?: string
  // 自定义节点显示（用于 SubAgent 节点步骤）
  nodeLabel?: string        // 自定义节点标签（替代 "迭代 X"）
  nodeType?: string         // 节点类型（用于显示图标）
  errorMessage?: string     // 错误信息
  reactAgentSteps?: ReActStepDetail[]  // ReAct Agent 内部步骤（用于嵌套展示）
  isRunning?: boolean       // 是否正在运行（用于流式效果）
}

// 状态配置（类似 SubAgentDetailsDrawer 的 TimelineNode）
function getStatusConfig(status: AgentStep['status'], streaming?: boolean) {
  if (streaming) {
    return {
      icon: Loader2,
      iconClass: 'text-blue-400 animate-spin',
      borderClass: 'border-blue-500/50',
      bgClass: 'bg-blue-500/10',
    }
  }

  switch (status) {
    case 'thinking':
      return {
        icon: Brain,
        iconClass: 'text-yellow-400',
        borderClass: 'border-yellow-500/50',
        bgClass: 'bg-yellow-500/10',
      }
    case 'acting':
      return {
        icon: Wrench,
        iconClass: 'text-blue-400',
        borderClass: 'border-blue-500/50',
        bgClass: 'bg-blue-500/10',
      }
    case 'observing':
      return {
        icon: Eye,
        iconClass: 'text-blue-400',
        borderClass: 'border-blue-500/50',
        bgClass: 'bg-blue-500/10',
      }
    case 'completed':
      return {
        icon: CheckCircle,
        iconClass: 'text-green-400',
        borderClass: 'border-green-500/50',
        bgClass: 'bg-green-500/10',
      }
    case 'error':
      return {
        icon: XCircle,
        iconClass: 'text-red-400',
        borderClass: 'border-red-500/50',
        bgClass: 'bg-red-500/10',
      }
  }
}

// 判断是否为执行中状态
function isActiveStatus(status: AgentStep['status']): boolean {
  return status === 'thinking' || status === 'acting' || status === 'observing'
}

// 状态对应的标签文本
const statusLabels: Record<AgentStep['status'], string> = {
  thinking: '思考中',
  acting: '执行工具',
  observing: '观察结果',
  completed: '完成',
  error: '错误',
}

// 格式化时间
function formatDuration(startedAt: number, completedAt?: number): string {
  if (!completedAt) return ''
  const duration = completedAt - startedAt
  if (duration < 1000) return `${duration}ms`
  return `${(duration / 1000).toFixed(1)}s`
}

// 便捷小图标映射（内嵌工具内联图标）
function inlineToolIcon(toolName: string) {
  if (toolName.startsWith('workflow_')) {
    return <Cog className="w-4 h-4 text-blue-400" />
  }
  switch (toolName) {
    case 'readFile':
    case 'writeFile':
    case 'writeMultipleFiles':
      return <FileText className="w-4 h-4 text-amber-400" />
    case 'executeCommand':
    case 'executePython':
      return <Terminal className="w-4 h-4 text-green-400" />
    case 'httpRequest':
      return <Globe className="w-4 h-4 text-blue-400" />
    case 'getCurrentDate':
      return <Calendar className="w-4 h-4 text-cyan-400" />
    case 'todos':
      return <Cog className="w-4 h-4 text-orange-400" />
    default:
      return <Cog className="w-4 h-4 text-gray-400" />
  }
}

// 工具调用输入/输出的友好格式化组件
function ToolCallInputOutput({ toolCall }: { toolCall: { toolName: string; input: unknown; output?: unknown; status: string } }) {
  const { toolName, input, output, status } = toolCall

  // 解析输入
  const inputObj = typeof input === 'string' ? (() => {
    try { return JSON.parse(input) } catch { return { raw: input } }
  })() : input

  // 解析输出
  const outputObj = typeof output === 'string' ? (() => {
    try { return JSON.parse(output) } catch { return output }
  })() : output

  // readFile - 显示文件路径和内容预览
  if (toolName === 'readFile' || toolName === 'writeFile') {
    const filePath = inputObj?.filePath || inputObj?.path || inputObj?.filename || 'unknown'
    const content = outputObj?.content || outputObj || ''
    const isWrite = toolName === 'writeFile'
    const writeContent = inputObj?.content || ''

    return (
      <div className="space-y-2">
        {/* 文件路径 */}
        <div className="flex items-center gap-2 text-xs">
          <FileText className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{filePath}</span>
          {isWrite && <span className="text-xs text-green-400">写入</span>}
        </div>

        {/* 读取的内容预览 */}
        {!isWrite && content && status === 'completed' && (
          <div className="bg-[var(--color-bg-hover)] rounded p-2 text-xs">
            <div className="text-[var(--color-text-muted)] mb-1 text-[10px] uppercase tracking-wider">内容预览</div>
            <pre className="text-[var(--color-text)] whitespace-pre-wrap font-mono text-xs max-h-24 overflow-y-auto">
              {typeof content === 'string' ? content.slice(0, 500) : JSON.stringify(content, null, 2).slice(0, 500)}
              {(typeof content === 'string' ? content.length : JSON.stringify(content).length) > 500 && '...'}
            </pre>
          </div>
        )}

        {/* 写入的内容预览 */}
        {isWrite && writeContent && (
          <div className="bg-green-500/5 rounded p-2 text-xs border border-green-500/10">
            <div className="text-green-600 dark:text-green-400 mb-1 text-[10px] uppercase tracking-wider">写入内容</div>
            <pre className="text-[var(--color-text)] whitespace-pre-wrap font-mono text-xs max-h-24 overflow-y-auto">
              {typeof writeContent === 'string' ? writeContent.slice(0, 300) : JSON.stringify(writeContent, null, 2).slice(0, 300)}
              {(typeof writeContent === 'string' ? writeContent.length : JSON.stringify(writeContent).length) > 300 && '...'}
            </pre>
          </div>
        )}
      </div>
    )
  }

  // executeCommand - 显示命令和执行结果
  if (toolName === 'executeCommand' || toolName === 'executePython') {
    const command = inputObj?.command || inputObj?.cmd || input || ''
    const result = outputObj?.stdout || outputObj?.output || outputObj || ''
    const error = outputObj?.stderr || outputObj?.error || ''

    return (
      <div className="space-y-2">
        {/* 命令 */}
        <div className="bg-[var(--color-bg-hover)] rounded p-2">
          <div className="text-[var(--color-text-muted)] mb-1 text-[10px] uppercase tracking-wider flex items-center gap-1">
            <Terminal className="w-3 h-3" />
            命令
          </div>
          <code className="text-xs font-mono text-green-400 block whitespace-pre-wrap">{typeof command === 'string' ? command : JSON.stringify(command)}</code>
        </div>

        {/* 执行结果 */}
        {result && status === 'completed' && (
          <div className="bg-green-500/5 rounded p-2 text-xs border border-green-500/10">
            <div className="text-green-600 dark:text-green-400 mb-1 text-[10px] uppercase tracking-wider">输出</div>
            <pre className="text-[var(--color-text)] whitespace-pre-wrap font-mono text-xs max-h-32 overflow-y-auto">
              {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        {/* 错误输出 */}
        {error && (
          <div className="bg-red-500/5 rounded p-2 text-xs border border-red-500/10">
            <div className="text-red-400 mb-1 text-[10px] uppercase tracking-wider">错误</div>
            <pre className="text-red-300 whitespace-pre-wrap font-mono text-xs max-h-24 overflow-y-auto">{typeof error === 'string' ? error : JSON.stringify(error)}</pre>
          </div>
        )}
      </div>
    )
  }

  // httpRequest - 显示 URL 和响应
  if (toolName === 'httpRequest') {
    const url = inputObj?.url || inputObj?.endpoint || ''
    const method = (inputObj?.method || 'GET').toUpperCase()
    const response = outputObj?.body || outputObj?.data || outputObj || ''

    return (
      <div className="space-y-2">
        {/* URL 和方法 */}
        <div className="flex items-center gap-2 text-xs">
          <span className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-medium',
            method === 'GET' && 'bg-blue-500/20 text-blue-400',
            method === 'POST' && 'bg-green-500/20 text-green-400',
            method === 'PUT' && 'bg-yellow-500/20 text-yellow-400',
            method === 'DELETE' && 'bg-red-500/20 text-red-400',
            !['GET', 'POST', 'PUT', 'DELETE'].includes(method) && 'bg-gray-500/20 text-gray-400'
          )}>
            {method}
          </span>
          <span className="font-mono text-blue-400 truncate">{url}</span>
        </div>

        {/* 响应预览 */}
        {response && status === 'completed' && (
          <div className="bg-[var(--color-bg-hover)] rounded p-2 text-xs">
            <div className="text-[var(--color-text-muted)] mb-1 text-[10px] uppercase tracking-wider">响应</div>
            <pre className="text-[var(--color-text)] whitespace-pre-wrap font-mono text-xs max-h-32 overflow-y-auto">
              {typeof response === 'string' ? response.slice(0, 500) : JSON.stringify(response, null, 2).slice(0, 500)}
              {(typeof response === 'string' ? response.length : JSON.stringify(response).length) > 500 && '...'}
            </pre>
          </div>
        )}
      </div>
    )
  }

  // 通用工具 - 使用键值对展示
  return (
    <div className="space-y-2">
      {/* 输入参数 - 友好的键值对 */}
      {inputObj && typeof inputObj === 'object' && Object.keys(inputObj).length > 0 && (
        <div className="bg-[var(--color-bg-hover)] rounded p-2">
          <div className="text-[var(--color-text-muted)] mb-2 text-[10px] uppercase tracking-wider">参数</div>
          <div className="space-y-1">
            {Object.entries(inputObj).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span className="text-[var(--color-text-muted)] shrink-0">{key}:</span>
                <span className="text-[var(--color-text)] font-mono truncate">
                  {typeof value === 'string' ? value : JSON.stringify(value).slice(0, 100)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 输出结果 */}
      {output !== undefined && status === 'completed' && (
        <div className="bg-[var(--color-bg-hover)] rounded p-2 text-xs">
          <div className="text-[var(--color-text-muted)] mb-1 text-[10px] uppercase tracking-wider">结果</div>
          <pre className="text-[var(--color-text)] whitespace-pre-wrap font-mono text-xs max-h-32 overflow-y-auto">
            {typeof outputObj === 'string' ? outputObj : JSON.stringify(outputObj, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export const AgentStepBlock = memo(function AgentStepBlock({
  step,
  isLast: _isLast, // keep for compatibility
  defaultExpanded = true,
  forceCollapsed = false,
  className,
  nodeLabel,
  nodeType,
  errorMessage,
  reactAgentSteps,
  isRunning: _isRunning = false, // retained for compatibility
}: AgentStepBlockProps) {
  // Collapse completed steps by default, but keep the current/active step expanded
  const [expanded, setExpanded] = useState(() => {
    // If this step is completed, collapse by default
    if (step.status === 'completed') return false
    return defaultExpanded
  })
  const thoughtContainerRef = useRef<HTMLDivElement>(null)

  // 自动滚动思考内容（流式）
  useEffect(() => {
    if (step.thoughtStreaming && thoughtContainerRef.current) {
      const el = thoughtContainerRef.current
      const shouldScroll = el.scrollHeight - el.scrollTop - el.clientHeight < 50
      if (shouldScroll) el.scrollTop = el.scrollHeight
    }
  }, [step.thought, step.thoughtStreaming])

  // forceCollapsed 会强制收起内容（适用于执行完成后的全局收起）
  useEffect(() => {
    if (forceCollapsed) setExpanded(false)
  }, [forceCollapsed])

  const hasToolCalls = step.toolCalls && step.toolCalls.length > 0
  const hasContent = step.thought || step.toolCall || hasToolCalls || step.observation || errorMessage || reactAgentSteps
  const duration = step.completedAt ? formatDuration(step.startedAt, step.completedAt) : ''

  // 节点类型图标（简化方案，沿用原实现的兼容性逻辑）
  function getNodeTypeIcon() {
    if (!nodeType) return null
    switch (nodeType) {
      case 'ollamaChat': return '💬'
      case 'reactAgent': return '🧠'
      case 'input': return '📥'
      case 'output': return '📤'
      case 'readFile': return '📖'
      case 'writeFile': return '✏️'
      case 'executeCommand': return '⚡'
      case 'httpRequest': return '🌐'
      case 'if': return '🔀'
      case 'loop': return '🔁'
      default: return '⚙️'
    }
  }

  // 通过策略化获取状态样式
  const statusConfig = getStatusConfig(step.status, step.thoughtStreaming)
  const StatusIcon = statusConfig.icon

  // Thought preview（前2行）
  const thoughtLines = step.thought?.split('\n') ?? []
  const thoughtPreview = thoughtLines.slice(0, 2).join('\n')
  const thoughtHasMore = thoughtLines.length > 2

  // 观察内容是否为 JSON，以便使用代码高亮渲染
  const observationContent = step.observation ?? ''
  const isObservationJson = observationContent.trim().startsWith('{') || observationContent.trim().startsWith('[')

  // 简单节流动画控制：当 step.toolCalls.length > 0 时，使用延迟来实现错峰出现
  const toolCallDelay = (idx: number) => idx * 0.04

  // 右侧内容渲染入口：用于组合成一个现代卡片风格的区域
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative mb-4',
        // 卡片外观：圆角 + 阴影
        'rounded-xl shadow-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]',
        className
      )}
    >
      {/* 左侧时间线圆点与连线（简化实现，保持竖线风格） */}
      <div className="absolute -left-6 top-0 bottom-0 w-6 flex items-center justify-center">
        {/* 连线用一个细竖线 */}
        <span className="w-1.5 h-full bg-[var(--color-border-subtle)]" aria-hidden />
        {/* 当前步骤状态圆点 */}
        <div
          className={cn(
            'absolute left-0 w-5 h-5 rounded-full -translate-x-1/2 flex items-center justify-center',
            statusConfig.bgClass,
            statusConfig.borderClass
          )}
        >
          <StatusIcon className={cn('w-3 h-3', statusConfig.iconClass, isActiveStatus(step.status) && 'animate-pulse')} />
        </div>
      </div>

      {/* 节点内容标题行 */}
      <div className="pl-8 pr-4 py-3 flex items-center w-full">
        <div className="flex items-center gap-2 flex-1">
          {nodeLabel ? (
            <span className="text-sm text-[var(--color-text)] font-medium">{nodeLabel}</span>
          ) : (
            <span className="text-sm text-[var(--color-text)] font-medium">思考轮次 {step.iteration}{step.maxIterations ? `/${step.maxIterations}` : ''}</span>
          )}
          {nodeLabel && getNodeTypeIcon() && (
            <span className="text-sm ml-1">{getNodeTypeIcon()}</span>
          )}
        </div>
        {/* 状态标签 */}
        <span
          className={cn(
            'text-xs px-1.5 py-0.5 rounded ml-2',
            statusConfig.bgClass,
            statusConfig.iconClass,
            isActiveStatus(step.status) && 'animate-pulse'
          )}
        >
          {statusLabels[step.status]}
        </span>
        {duration && (
          <span className="text-xs text-[var(--color-text-muted)] ml-2">{duration}</span>
        )}
        {/* 展开/收起按钮（仅在有内容时） */}
        {hasContent && (
          <button
            aria-label="Expand or collapse"
            onClick={() => setExpanded((v) => !v)}
            className={cn('ml-auto p-1 rounded hover:bg-[var(--color-bg-hover)]', expanded && 'bg-[var(--color-bg-hover)]')}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
            )}
          </button>
        )}
      </div>

      {/* 展开内容区（内容丰富的卡片） */}
      <AnimatePresence>
        {expanded && hasContent && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -6 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4 overflow-hidden"
          >
            {/* 思考内容（前两行预览，支持展开） */}
            {step.thought && (
              <section className="mb-2">
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mb-1">
                  <Brain className="w-3 h-3" />
                  <span>思考</span>
                </div>
                <div ref={thoughtContainerRef} className="text-sm text-[var(--color-text)] bg-yellow-500/5 rounded-lg p-2 border border-yellow-500/10 relative overflow-hidden" style={{ maxHeight: expanded ? 180 : 60 }}>
                  {step.thoughtStreaming ? (
                    <div className="whitespace-pre-wrap">{step.thought}{' '}</div>
                  ) : (
                    expanded ? (
                      <AgentMarkdown content={step.thought} />
                    ) : (
                      <div className="whitespace-pre-wrap select-none" aria-label="thought-preview">
                        {thoughtPreview}
                        {thoughtHasMore && <span className="text-[var(--color-text-muted)]">…</span>}
                      </div>
                    )
                  )}
                </div>
              </section>
            )}

            {(step.toolCall || hasToolCalls) && (
              <section className="mb-2">
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mb-1">
                  <Wrench className="w-3 h-3" />
                  <span>
                    {hasToolCalls && step.toolCalls!.length > 1
                      ? `工具调用 (${step.toolCalls!.length} 个并行)`
                      : '工具调用'}
                  </span>
                </div>
                {step.toolCall && !hasToolCalls && (
                  <div className="p-2 bg-[var(--color-bg-input)] rounded-lg border border-[var(--color-border-subtle)]" aria-label="tool-call-single">
                    <div className="flex items-center gap-2 mb-2">
                      {inlineToolIcon(step.toolCall.toolName)}
                      <span className="font-mono text-sm">{step.toolCall.toolName}</span>
                    </div>
                    <ToolCallInputOutput toolCall={step.toolCall} />
                  </div>
                )}
                {hasToolCalls && (
                  <div className="space-y-2 mt-1">
                    {step.toolCalls!.map((tc, idx) => (
                      <motion.div
                        key={tc.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: toolCallDelay(idx) }}
                        className={cn('p-2 bg-[var(--color-bg-input)] rounded-lg border border-[var(--color-border-subtle)]')}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {inlineToolIcon(tc.toolName)}
                          <span className="font-mono text-sm">{tc.toolName}</span>
                          {idx === 0 && step.toolCalls!.length > 1 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 ml-auto">parallel</span>
                          )}
                        </div>
                        <ToolCallInputOutput toolCall={tc} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 观察结果（代码高亮展示） */}
            {step.observation && (
              <section className="mb-2">
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mb-1">
                  <Eye className="w-3 h-3" />
                  <span>观察结果</span>
                </div>
                <div className={cn(
                  'rounded-lg p-2 text-xs overflow-auto max-h-48',
                  step.observationStreaming ? 'bg-blue-500/5 border border-blue-500/10' : 'bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)]'
                )}>
                  {isObservationJson ? (
                    <AgentMarkdown content={`\`\`\`json\n${observationContent}\n\`\`\``} />
                  ) : (
                    <pre className="whitespace-pre wrap text-[var(--color-text)]">{observationContent}</pre>
                  )}
                </div>
              </section>
            )}

            {/* 错误信息 */}
            {errorMessage && (
              <section className="mb-2">
                <div className="flex items-center gap-1 text-xs text-red-400 mb-1">
                  <XCircle className="w-3 h-3" />
                  <span>错误</span>
                </div>
                <div className="text-sm text-red-300 bg-red-500/5 border border-red-500/10 rounded-lg p-2 whitespace-pre-wrap">{errorMessage}</div>
              </section>
            )}

            {/* ReAct Agent 内部步骤（嵌套展示） */}
            {reactAgentSteps && reactAgentSteps.length > 0 && (
              <section className="mt-2 pl-2 border-l-2 border-blue-500/20">
                <div className="flex items-center gap-1 text-xs text-blue-400 mb-2">
                  <span>🔄</span>
                  <span>内部步骤 ({reactAgentSteps.length})</span>
                </div>
                <div className="space-y-1">
                  {reactAgentSteps.slice(-3).map((reactStep) => (
                    <div key={reactStep.iteration} className="text-xs">
                      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                        <span>思考轮次 {reactStep.iteration}/{reactStep.maxIterations ?? '?'}</span>
                        <span className="px-1 py-0.5 rounded bg-[var(--color-bg-hover)] text-blue-600 text-xs">{statusLabels[reactStep.status]}</span>
                      </div>
                      {reactStep.thought && (
                        <div className="mt-1 text-[var(--color-text)] bg-yellow-500/5 rounded px-2 py-1">
                          {reactStep.thought.slice(0, 100)}{reactStep.thought.length > 100 ? '…' : ''}
                        </div>
                      )}
                      {reactStep.toolCall && (
                        <div className="mt-1 text-blue-400">→ {reactStep.toolCall.toolName}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

export default AgentStepBlock
