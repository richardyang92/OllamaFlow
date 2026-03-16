/**
 * 推理步骤块组件
 * 展示单个推理步骤，包括思考过程、工具调用和观察结果
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentStep, ReActStepDetail } from '@/store/agent-store'
import { ToolCallBlock } from './ToolCallBlock'
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
        iconClass: 'text-purple-400',
        borderClass: 'border-purple-500/50',
        bgClass: 'bg-purple-500/10',
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

// ReAct 步骤状态徽章
function StepStatusBadge({ status }: { status: ReActStepDetail['status'] }) {
  const config: Record<ReActStepDetail['status'], { bg: string; text: string; label: string }> = {
    thinking: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: '思考中' },
    acting: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: '执行工具' },
    observing: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: '观察结果' },
    completed: { bg: 'bg-green-500/10', text: 'text-green-400', label: '已完成' },
    error: { bg: 'bg-red-500/10', text: 'text-red-400', label: '错误' },
  }
  const { bg, text, label } = config[status]
  return <span className={cn('text-xs px-1.5 py-0.5 rounded', bg, text)}>{label}</span>
}

export const AgentStepBlock = memo(function AgentStepBlock({
  step,
  isLast: _isLast, // 保留参数但不使用（用于兼容现有调用）
  defaultExpanded = true,
  forceCollapsed = false,
  className,
  nodeLabel,
  nodeType,
  errorMessage,
  reactAgentSteps,
  isRunning: _isRunning = false, // 保留参数但不使用
}: AgentStepBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const thoughtContainerRef = useRef<HTMLDivElement>(null)

  // 当思考内容流式更新时，自动滚动到底部（仅当用户已在底部附近时）
  useEffect(() => {
    if (step.thoughtStreaming && thoughtContainerRef.current) {
      const scrollToBottom = () => {
        if (thoughtContainerRef.current) {
          const currentContainer = thoughtContainerRef.current
          // 只有当用户已经在底部附近时（距离底部小于50px）才自动滚动
          const isNearBottom = currentContainer.scrollHeight - currentContainer.scrollTop - currentContainer.clientHeight < 50
          if (isNearBottom) {
            currentContainer.scrollTop = currentContainer.scrollHeight
          }
        }
      }
      scrollToBottom()
      // 使用 setTimeout 确保内容更新后再滚动
      const timeoutId = setTimeout(scrollToBottom, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [step.thought, step.thoughtStreaming])

  // 当 forceCollapsed 变为 true 时，自动收起（只在 forceCollapsed 变化时触发，不阻止用户手动展开）
  useEffect(() => {
    if (forceCollapsed) {
      setExpanded(false)
    }
  }, [forceCollapsed])

  const hasToolCalls = step.toolCalls && step.toolCalls.length > 0
  const hasContent = step.thought || step.toolCall || hasToolCalls || step.observation || errorMessage || reactAgentSteps
  const duration = step.completedAt ? formatDuration(step.startedAt, step.completedAt) : ''

  // 获取节点类型图标
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

  // 获取状态配置（SubAgent 风格）
  const statusConfig = getStatusConfig(step.status, step.thoughtStreaming)
  const StatusIcon = statusConfig.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'relative',
        // 主Agent 样式：使用 pl-8 给圆点留空间
        !nodeLabel && 'pl-8 pb-4',
        // 节点步骤样式：简化左边框
        nodeLabel && 'pl-4',
        nodeLabel && 'border-l-2 border-purple-500/20',
        className
      )}
    >
      {/* 主Agent 时间线：圆点标记和连接线（SubAgent 风格） */}
      {!nodeLabel && (
        <>
          {/* 圆点标记 */}
          <div
            className={cn(
              'absolute left-0 top-0 w-6 h-6 rounded-full z-10',
              'flex items-center justify-center',
              'border-2',
              'bg-[var(--color-bg-elevated)]',
              statusConfig.borderClass
            )}
          >
            <StatusIcon className={cn('w-3.5 h-3.5', statusConfig.iconClass)} />
          </div>
        </>
      )}

      {/* 节点步骤：简单圆点标记 */}
      {nodeLabel && (
        <div className="absolute left-0 top-1.5 flex items-center justify-center w-4 h-4 -translate-x-1/2">
          <span className="w-2 h-2 rounded-full bg-purple-500/30" />
        </div>
      )}

      {/* 节点内容 */}
      <div className={nodeLabel ? '' : 'pl-0'}>
        {/* 步骤标题按钮 */}
        <button
          onClick={() => hasContent && setExpanded(!expanded)}
          disabled={!hasContent}
          className={cn(
            'w-full flex items-center gap-2 py-1 px-2 ml-2 rounded-md',
            'hover:bg-[var(--color-bg-input)]/50',
            'transition-colors text-left',
            !hasContent && 'cursor-default'
          )}
        >
          {/* 展开/收起图标 */}
          {hasContent && (
            expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
            )
          )}

          {/* 自定义节点标签或默认迭代显示 */}
          {nodeLabel ? (
            <>
              {getNodeTypeIcon() && <span className="text-sm">{getNodeTypeIcon()}</span>}
              <span className="text-sm text-[var(--color-text)] font-medium">{nodeLabel}</span>
            </>
          ) : (
            <span className="text-xs font-medium text-[var(--color-text)]">
              迭代 {step.iteration}
            </span>
          )}

          {/* 状态徽章 */}
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            statusConfig.bgClass,
            statusConfig.iconClass,
            // 执行中状态添加闪烁动画
            isActiveStatus(step.status) && 'animate-pulse'
          )}>
            {statusLabels[step.status]}
          </span>

          {/* 执行时长 */}
          {duration && (
            <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0 ml-auto">
              {duration}
            </span>
          )}
        </button>
      </div>

      {/* 展开内容 */}
      <AnimatePresence>
        {expanded && hasContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {/* 思考内容 - 当有 ReAct 内部步骤时不显示，避免重复 */}
            {step.thought && !reactAgentSteps && (
              <div className="mt-2 mb-2">
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mb-1">
                  <Brain className="w-3 h-3" />
                  <span>思考</span>
                </div>
                <div
                  ref={thoughtContainerRef}
                  className="text-sm text-[var(--color-text)] bg-yellow-500/5 border border-yellow-500/10 rounded-lg p-2 max-h-48 overflow-y-auto"
                >
                  {step.thoughtStreaming ? (
                    // 流式输出时直接显示文本
                    <div className="whitespace-pre-wrap">
                      {step.thought}
                      <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-400 animate-pulse" />
                    </div>
                  ) : (
                    // 完成后渲染 Markdown
                    <AgentMarkdown content={step.thought} />
                  )}
                </div>
              </div>
            )}

            {/* 工具调用 - 支持单个和多个并行工具 */}
            {(step.toolCall || hasToolCalls) && (
              <div className="mt-2 mb-2">
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mb-1">
                  <Wrench className="w-3 h-3" />
                  <span>
                    {hasToolCalls && step.toolCalls!.length > 1
                      ? `工具调用 (${step.toolCalls!.length} 个并行)`
                      : '工具调用'}
                  </span>
                </div>
                {/* 单个工具调用（兼容旧格式） */}
                {step.toolCall && !hasToolCalls && (
                  <ToolCallBlock
                    toolCall={step.toolCall}
                    defaultExpanded={step.toolCall.status === 'error'}
                  />
                )}
                {/* 多个并行工具调用 */}
                {hasToolCalls && (
                  <div className="space-y-2">
                    {step.toolCalls!.map((tc, index) => (
                      <div key={tc.id} className="relative pl-6">
                        {step.toolCalls!.length > 1 && (
                          <div className="absolute left-0 top-2 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] flex items-center justify-center font-medium">
                            {index + 1}
                          </div>
                        )}
                        <ToolCallBlock
                          toolCall={tc}
                          defaultExpanded={tc.status === 'error' || step.toolCalls!.length === 1}
                          showParallelBadge={step.toolCalls!.length > 1}
                          parallelIndex={index + 1}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 观察结果 */}
            {step.observation && (
              <div className="mt-2 mb-2">
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mb-1">
                  <Eye className="w-3 h-3" />
                  <span>观察结果</span>
                </div>
                <div className={cn(
                  'text-sm rounded-lg p-2 whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto',
                  step.observationError
                    ? 'bg-red-500/5 border border-red-500/10 text-red-300'
                    : 'bg-purple-500/5 border border-purple-500/10 text-purple-400'
                )}>
                  {step.observation}
                  {step.observationStreaming && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-400 animate-pulse" />
                  )}
                </div>
              </div>
            )}

            {/* 错误信息 */}
            {errorMessage && (
              <div className="mt-2 mb-2">
                <div className="flex items-center gap-1 text-xs text-red-400 mb-1">
                  <XCircle className="w-3 h-3" />
                  <span>错误</span>
                </div>
                <div className="text-sm text-red-300 bg-red-500/5 border border-red-500/10 rounded-lg p-2 whitespace-pre-wrap">
                  {errorMessage}
                </div>
              </div>
            )}

            {/* ReAct Agent 内部步骤（嵌套展示） */}
            {reactAgentSteps && reactAgentSteps.length > 0 && (
              <div className="mt-2 mb-2 pl-2 border-l-2 border-purple-500/20">
                <div className="flex items-center gap-1 text-xs text-purple-400 mb-2">
                  <span>🔄</span>
                  <span>内部步骤 ({reactAgentSteps.length})</span>
                </div>
                <div className="space-y-1">
                  {reactAgentSteps.slice(-3).map((reactStep) => (
                    <div key={reactStep.id} className="text-xs">
                      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                        <span>迭代 {reactStep.iteration}</span>
                        <StepStatusBadge status={reactStep.status} />
                      </div>
                      {reactStep.thought && (
                        <div className="mt-1 text-[var(--color-text)] bg-yellow-500/5 rounded px-2 py-1">
                          {reactStep.thought.slice(0, 100)}
                          {reactStep.thought.length > 100 && '...'}
                        </div>
                      )}
                      {reactStep.toolCall && (
                        <div className="mt-1 text-blue-400">
                          → {reactStep.toolCall.toolName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

export default AgentStepBlock
