/**
 * 工具调用块组件
 * 展示单个工具调用的状态、参数和结果
 */

import { useState, memo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  FileText,
  Cog,
  Workflow,
  Globe,
  Terminal,
  Calendar,
} from 'lucide-react'
// Workflow 已在上面的导入中
import { cn } from '@/lib/utils'
import type { ToolCallRecord, SubAgentProgress, ReActStepDetail } from '@/store/agent-store'
import StreamingFlashText from '@/components/nodes/shared/StreamingFlashText'
import { AgentStepBlock } from './AgentStepBlock'
import { useAgentStore } from '@/store/agent-store'

interface ToolCallBlockProps {
  toolCall: ToolCallRecord
  defaultExpanded?: boolean
  className?: string
  showParallelBadge?: boolean
  parallelIndex?: number
  // 用于打开详情面板
  messageId?: string
  stepId?: string
}

// 工具图标映射
function getToolIcon(toolName: string) {
  if (toolName.startsWith('workflow_')) {
    return <Workflow className="w-4 h-4 text-purple-400" />
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

// 状态图标
function StatusIcon({ status }: { status: ToolCallRecord['status'] }) {
  switch (status) {
    case 'pending':
      return <Clock className="w-4 h-4 text-gray-400" />
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-400" />
    case 'error':
      return <XCircle className="w-4 h-4 text-red-400" />
  }
}

// 状态对应的样式
const statusStyles: Record<ToolCallRecord['status'], string> = {
  pending: 'bg-gray-500/5 border-gray-500/20',
  running: 'bg-blue-500/5 border-blue-500/20',
  completed: 'bg-green-500/5 border-green-500/20',
  error: 'bg-red-500/5 border-red-500/20',
}

// SubAgent 进度状态标签
const subAgentStatusLabels: Record<SubAgentProgress['status'], string> = {
  loading: '加载中',
  running: '执行中',
  completed: '已完成',
  error: '失败',
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

// ReAct 历史步骤组件
function HistoryStepsSection({ steps }: { steps: ReActStepDetail[] }) {
  const [expanded, setExpanded] = useState(false)

  if (steps.length === 0) return null

  return (
    <div className="border-t border-[var(--color-border-subtle)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
        <span>历史步骤 ({steps.length})</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto px-3 pb-2">
              {steps.map((step) => (
                <div key={step.id} className="py-1 border-b border-[var(--color-border-subtle)] last:border-b-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--color-text-muted)]">迭代 {step.iteration}</span>
                    <StepStatusBadge status={step.status} />
                    {step.toolCall && (
                      <span className="text-blue-400 truncate max-w-[120px]">
                        → {step.toolCall.toolName}
                      </span>
                    )}
                    {step.completedAt && (
                      <span className="text-[var(--color-text-muted)] ml-auto text-[10px]">
                        {step.completedAt - step.startedAt}ms
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ReAct 当前步骤详情组件
function CurrentStepSection({
  step,
  isRunning
}: {
  step: ReActStepDetail
  isRunning: boolean
}) {
  return (
    <div className="px-3 py-2 border-t border-[var(--color-border-subtle)] bg-purple-500/5">
      {/* 状态徽章 */}
      <div className="flex items-center gap-2 mb-2">
        <StepStatusBadge status={step.status} />
        {step.thoughtStreaming && isRunning && (
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-[10px] text-yellow-400"
          >
            streaming...
          </motion.span>
        )}
      </div>

      {/* 思考内容 */}
      {step.thought && (
        <div className="mb-2">
          <div className="flex items-center gap-1 text-xs text-yellow-400 mb-1">
            <span>💭</span>
            <span>思考</span>
          </div>
          <div className="text-xs text-[var(--color-text)] bg-yellow-500/5 border border-yellow-500/10 rounded px-2 py-1.5 whitespace-pre-wrap max-h-32 overflow-y-auto">
            {step.thought}
            {step.thoughtStreaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-yellow-400 animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* 工具调用 */}
      {step.toolCall && (
        <div className="mb-2">
          <div className="flex items-center gap-1 text-xs text-blue-400 mb-1">
            <span>🔧</span>
            <span>工具调用: {step.toolCall.toolName}</span>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/10 rounded overflow-hidden">
            {/* 输入参数 */}
            <div className="px-2 py-1.5 border-b border-blue-500/10">
              <span className="text-[10px] text-[var(--color-text-muted)]">输入参数</span>
              <pre className="text-xs text-[var(--color-text)] mt-0.5 whitespace-pre-wrap max-h-24 overflow-y-auto">
                {JSON.stringify(step.toolCall.input, null, 2)}
              </pre>
            </div>
            {/* 输出结果 */}
            {step.toolCall.output && (
              <div className="px-2 py-1.5">
                <span className={cn(
                  'text-[10px]',
                  step.toolCall.error ? 'text-red-400' : 'text-[var(--color-text-muted)]'
                )}>
                  {step.toolCall.error ? '错误' : '输出结果'}
                </span>
                <pre className="text-xs text-[var(--color-text)] mt-0.5 whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {step.toolCall.output}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 观察结果（如果没有包含在 toolCall 中） */}
      {step.observation && !step.toolCall && (
        <div>
          <div className={cn(
            'flex items-center gap-1 text-xs mb-1',
            step.observationError ? 'text-red-400' : 'text-cyan-400'
          )}>
            <span>{step.observationError ? '❌' : '👁'}</span>
            <span>{step.observationError ? '错误' : '观察结果'}</span>
          </div>
          <div className={cn(
            'text-xs border rounded px-2 py-1.5 whitespace-pre-wrap max-h-32 overflow-y-auto',
            step.observationError
              ? 'text-red-300 bg-red-500/5 border-red-500/10'
              : 'text-[var(--color-text)] bg-cyan-500/5 border-cyan-500/10'
          )}>
            {step.observation}
            {step.observationStreaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-cyan-400 animate-pulse" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Ollama Chat 详情组件
function OllamaChatDetailPanel({
  detail,
  isRunning
}: {
  detail: NonNullable<SubAgentProgress['ollamaChatDetail']>
  isRunning: boolean
}) {
  const [showFullResponse, setShowFullResponse] = useState(false)

  // 截取预览（用于初始显示）
  const responsePreview = detail.responseContent
    ? (detail.responseContent.length > 300
        ? detail.responseContent.slice(0, 300) + '...'
        : detail.responseContent)
    : null

  // 是否有推理内容
  const hasReasoning = detail.reasoningContent && detail.reasoningContent.trim().length > 0
  // 是否有响应内容
  const hasResponse = detail.responseContent && detail.responseContent.trim().length > 0

  return (
    <div className="border-t border-[var(--color-border-subtle)]">
      {/* 标题栏 */}
      <div className="px-3 py-2 bg-blue-500/5 flex items-center gap-2">
        <span className="text-sm">💬</span>
        <span className="text-xs font-medium text-blue-400">
          {detail.nodeName}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          ({detail.model})
        </span>
        {isRunning && (
          <Loader2 className="w-3 h-3 text-blue-400 animate-spin ml-auto" />
        )}
      </div>

      {/* 推理/思考内容 */}
      {hasReasoning && (
        <div className="px-3 py-2 bg-amber-500/10 border-t border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <motion.span
              animate={detail.reasoningStreaming ? { rotate: 360 } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="text-sm"
            >
              🧠
            </motion.span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              推理思考
            </span>
            {detail.reasoningStreaming && (
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
            text={detail.reasoningContent || ''}
            isStreaming={detail.reasoningStreaming || false}
            maxLength={detail.reasoningStreaming ? 80 : 200}
            textColor="text-amber-700 dark:text-amber-300"
          />
        </div>
      )}

      {/* 普通/响应输出 */}
      {hasResponse && (
        <div className="px-3 py-2 border-t border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">📝</span>
            <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
              输出
            </span>
            {detail.responseStreaming && (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-[10px] text-green-600/60"
              >
                ●
              </motion.span>
            )}
          </div>
          <div className="text-xs text-[var(--color-text)] bg-green-500/5 border border-green-500/10 rounded px-2 py-1.5 whitespace-pre-wrap max-h-32 overflow-y-auto">
            {showFullResponse ? detail.responseContent : responsePreview}
            {detail.responseStreaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-green-400 animate-pulse" />
            )}
          </div>
          {detail.responseContent && detail.responseContent.length > 300 && (
            <button
              onClick={() => setShowFullResponse(!showFullResponse)}
              className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 transition-colors"
            >
              {showFullResponse ? '收起' : '展开全部'}
            </button>
          )}
        </div>
      )}

      {/* 加载状态（无内容时） */}
      {!hasReasoning && !hasResponse && isRunning && (
        <div className="px-3 py-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>等待模型响应...</span>
        </div>
      )}
    </div>
  )
}

// SubAgent 进度展示组件
function SubAgentProgressPanel({ progress }: { progress: SubAgentProgress }) {
  const isRunning = progress.status === 'running' || progress.status === 'loading'

  // 计算进度百分比
  const totalNodes = progress.totalNodes ?? 0
  const completedNodes = progress.completedNodes ?? 0
  const progressPercent = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0

  return (
    <div className="border-t border-[var(--color-border-subtle)]">
      {/* 紧凑的单行进度栏：工作流名 + 状态 + 进度 + 当前节点 */}
      <div className="px-3 py-2 bg-purple-500/5 flex items-center gap-2">
        <Workflow className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
        <span className="text-xs text-purple-400 font-medium truncate">
          {progress.workflowName}
        </span>
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded flex-shrink-0',
          progress.status === 'loading' && 'bg-yellow-500/10 text-yellow-400',
          progress.status === 'running' && 'bg-blue-500/10 text-blue-400',
          progress.status === 'completed' && 'bg-green-500/10 text-green-400',
          progress.status === 'error' && 'bg-red-500/10 text-red-400',
        )}>
          {subAgentStatusLabels[progress.status]}
        </span>
        {/* 节点进度 */}
        {totalNodes > 0 && (
          <span className="text-xs text-purple-400 flex-shrink-0">
            {completedNodes}/{totalNodes}
            {progressPercent > 0 && <span className="text-[var(--color-text-muted)]">({progressPercent}%)</span>}
          </span>
        )}
        {/* 当前进度条 - 紧凑版 */}
        {totalNodes > 0 && (
          <div className="flex-1 h-1.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden max-w-[80px]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
              className={cn(
                'h-full rounded-full',
                progress.status === 'error'
                  ? 'bg-red-500'
                  : progress.status === 'completed'
                    ? 'bg-green-500'
                    : 'bg-gradient-to-r from-purple-500 to-blue-500'
              )}
            />
          </div>
        )}
        {/* 当前节点 */}
        {progress.currentNode && (
          <>
            <span className="text-[var(--color-text-muted)] flex-shrink-0">·</span>
            <span className="text-xs text-[var(--color-text)] truncate">
              {progress.currentNode}
            </span>
          </>
        )}
        {isRunning && (
          <Loader2 className="w-3 h-3 text-blue-400 animate-spin flex-shrink-0 ml-auto" />
        )}
      </div>

      {/* 嵌套节点详情已移除 - 这些详情应该在右侧抽屉或更高层级显示，避免重复 */}
    </div>
  )
}

// SubAgent 节点执行步骤时间线组件（独立展示）
function SubAgentNodeStepsTimeline({
  progress,
  isRunning
}: {
  progress: SubAgentProgress
  isRunning: boolean
}) {
  // 只在有节点步骤时显示
  if (!progress.nodeSteps || progress.nodeSteps.length === 0) {
    return null
  }

  return (
    <div className="mt-2">
      {/* 标题栏 */}
      <div className="px-3 py-1.5 bg-purple-500/5 border border-purple-500/10 rounded-t flex items-center gap-2">
        <span className="text-xs">⚡</span>
        <span className="text-xs font-medium text-purple-400">
          {progress.workflowName} - 节点执行
        </span>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">
          {progress.nodeSteps.filter(ns => ns.status === 'completed' || ns.status === 'error').length}/{progress.nodeSteps.length}
        </span>
      </div>

      {/* 节点步骤列表 - 使用 AgentStepBlock 展示每个节点，像主Agent一样 */}
      <div className="border border-t-0 border-purple-500/20 rounded-b bg-[var(--color-bg-input)]/10 p-2">
        {progress.nodeSteps.map((nodeStep, index) => {
          // 将节点步骤转换为 AgentStep 格式以便复用 AgentStepBlock
          const agentStep: {
            id: string
            iteration: number
            status: 'thinking' | 'acting' | 'observing' | 'completed' | 'error'
            thought?: string
            thoughtStreaming?: boolean
            toolCall?: ToolCallRecord
            observation?: string
            observationStreaming?: boolean
            startedAt: number
            completedAt?: number
          } = {
            id: nodeStep.id,
            iteration: 0, // 节点步骤没有迭代概念，设为 0
            status: nodeStep.status === 'pending' ? 'thinking'
              : nodeStep.status === 'running' ? 'acting'
              : nodeStep.status === 'completed' ? 'completed'
              : 'error',
            thought: nodeStep.thought,
            thoughtStreaming: nodeStep.thoughtStreaming,
            observation: nodeStep.observation,
            observationStreaming: nodeStep.observationStreaming,
            startedAt: nodeStep.startTime,
            completedAt: nodeStep.endTime,
          }

          return (
            <AgentStepBlock
              key={nodeStep.id}
              step={agentStep}
              isLast={index === progress.nodeSteps.length - 1}
              // 自定义节点名称显示
              nodeLabel={nodeStep.nodeName}
              nodeType={nodeStep.nodeType}
              // 显示错误信息
              errorMessage={nodeStep.error}
              // 如果是 ReAct Agent 节点，显示内部步骤
              reactAgentSteps={nodeStep.reactAgentSteps}
              isRunning={isRunning}
              // 节点步骤默认展开，方便查看
              defaultExpanded={nodeStep.status !== 'completed'}
              className="!border-l-0 !ml-0 !pl-4"
            />
          )
        })}
      </div>
    </div>
  )
}

export const ToolCallBlock = memo(function ToolCallBlock({
  toolCall,
  defaultExpanded = false,
  className,
  showParallelBadge,
  parallelIndex,
  messageId,
  stepId,
}: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  // 获取打开详情面板的方法
  const { setShowSubAgentDetailsPanel, setSelectedSubAgentKey, setShowLogsPanel } = useAgentStore()

  const toolName = toolCall.toolName
  const status = toolCall.status
  const duration = toolCall.duration
  const subAgentProgress = toolCall.subAgentProgress

  // 打开 SubAgent 详情面板
  const handleOpenDetails = () => {
    if (!toolCall.subAgentProgress || !messageId || !stepId) return
    // 使用 | 分隔符，因为 ID 中包含 _ (如 msg_xxx_yyy)
    const key = `${messageId}|${stepId}|${toolCall.id}`
    setSelectedSubAgentKey(key)
    setShowSubAgentDetailsPanel(true)
    // 同时打开侧边栏
    setShowLogsPanel(true)
  }

  // 判断 SubAgent 是否正在运行
  const isSubAgentRunning = subAgentProgress &&
    (subAgentProgress.status === 'running' || subAgentProgress.status === 'loading')

  // 如果 SubAgent 正在运行，自动展开
  // 注释掉：保持默认折叠状态，只显示紧凑摘要
  /*
  useEffect(() => {
    if (isSubAgentRunning && !expanded) {
      setExpanded(true)
    }
  }, [isSubAgentRunning, expanded])
  */

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border overflow-hidden transition-colors',
        statusStyles[status],
        isSubAgentRunning && 'border-blue-500/30',
        className
      )}
    >
      {/* Header - 可点击展开 */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon status={status} />
        {getToolIcon(toolName)}
        {/* 并行标识 */}
        {showParallelBadge && parallelIndex !== undefined && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
            #{parallelIndex}
          </span>
        )}
        <span className="font-mono text-sm text-[var(--color-text)]">
          {toolName}
        </span>
        {/* SubAgent 进度摘要 - 仅在收起时显示 */}
        {subAgentProgress && !expanded && (
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded ml-1 flex items-center gap-1.5',
            subAgentProgress.status === 'loading' && 'bg-yellow-500/10 text-yellow-400',
            subAgentProgress.status === 'running' && 'bg-blue-500/10 text-blue-400',
            subAgentProgress.status === 'completed' && 'bg-green-500/10 text-green-400',
            subAgentProgress.status === 'error' && 'bg-red-500/10 text-red-400',
          )}>
            <Workflow className="w-3 h-3 flex-shrink-0" />
            {/* 工作流名称 + 进度 */}
            <span className="truncate max-w-[200px]">
              {subAgentProgress.workflowName}
              {subAgentProgress.totalNodes > 0 && (
                <span className="opacity-70 ml-1">
                  {subAgentProgress.completedNodes}/{subAgentProgress.totalNodes}
                </span>
              )}
            </span>
            {/* 当前运行时显示当前节点 */}
            {subAgentProgress.status === 'running' && subAgentProgress.currentNode && (
              <span className="opacity-70 truncate max-w-[120px]" title={subAgentProgress.currentNode}>
                · {subAgentProgress.currentNode}
              </span>
            )}
          </span>
        )}
        {/* 时长 */}
        {duration !== undefined && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {duration}ms
          </span>
        )}
        {/* 查看详情按钮 - 有 SubAgent 进度时始终显示 */}
        {subAgentProgress && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleOpenDetails()
            }}
            className="text-xs text-purple-400 hover:text-purple-300 px-1.5 py-0.5 rounded hover:bg-purple-500/10 transition-colors"
          >
            查看详情
          </button>
        )}
        <ChevronDown
          className={cn(
            'w-4 h-4 ml-auto text-[var(--color-text-muted)] transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </div>

      {/* 展开内容 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* SubAgent 进度 - 展示工作流执行进度 */}
            {toolCall.subAgentProgress && (
              <SubAgentProgressPanel progress={toolCall.subAgentProgress} isRunning={isSubAgentRunning} />
            )}

            {/* 以下部分已移除 - 节点步骤现在显示在右侧抽屉中 */}
            {/* {toolCall.subAgentProgress && toolCall.subAgentProgress.nodeSteps && toolCall.subAgentProgress.nodeSteps.length > 0 && (
              <SubAgentNodeStepsTimeline
                progress={toolCall.subAgentProgress}
                isRunning={isSubAgentRunning}
              />
            )} */}

            {/* 错误信息 */}
            {toolCall.error && status === 'error' && (
              <div className="px-3 py-2 border-t border-red-500/20 bg-red-500/5">
                <div className="text-xs text-red-400 mb-1">错误信息</div>
                <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap">
                  {toolCall.error}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

export default ToolCallBlock
