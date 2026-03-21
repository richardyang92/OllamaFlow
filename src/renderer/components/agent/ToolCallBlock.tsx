/**
 * 工具调用块组件
 * 展示单个工具调用的状态、参数和结果
 */

import { useState, memo } from 'react'
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
  Brain,
  Zap,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolCallRecord, SubAgentProgress, ReActStepSummary } from '@/store/agent-store'

interface ToolCallBlockProps {
  toolCall: ToolCallRecord
  defaultExpanded?: boolean
  className?: string
  showParallelBadge?: boolean
  parallelIndex?: number
}

// 工具图标映射
function getToolIcon(toolName: string) {
  if (toolName.startsWith('workflow_')) {
    return <Workflow className="w-4 h-4 text-[var(--color-text-muted)]" />
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

// ReAct 步骤状态图标和颜色
function getReActStepConfig(status: ReActStepSummary['status']) {
  switch (status) {
    case 'thinking':
      return { icon: Brain, color: 'text-yellow-600', bg: 'bg-yellow-500/10', label: '思考' }
    case 'acting':
      return { icon: Zap, color: 'text-blue-600', bg: 'bg-blue-500/10', label: '执行' }
    case 'observing':
      return { icon: Eye, color: 'text-[var(--color-text-muted)]', bg: 'bg-[var(--color-bg-hover)]', label: '观察' }
    case 'completed':
      return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-500/10', label: '完成' }
    case 'error':
      return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-500/10', label: '错误' }
  }
}

// ReAct 步骤摘要组件
function ReActStepSummaryItem({ step, isLast }: { step: ReActStepSummary; isLast: boolean }) {
  const config = getReActStepConfig(step.status)
  const Icon = config.icon

  return (
    <div className={cn(
      'flex items-start gap-2 py-1',
      !isLast && 'border-l border-[var(--color-border-subtle)] ml-2 pl-3'
    )}>
      {/* 状态图标 */}
      <div className={cn('flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center', config.bg)}>
        <Icon className={cn('w-3 h-3', config.color, step.status !== 'completed' && step.status !== 'error' && 'animate-pulse')} />
      </div>
      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)]">#{step.iteration}</span>
          <span className={cn('text-[10px] px-1 py-0.5 rounded', config.bg, config.color)}>
            {config.label}
          </span>
        </div>
        {/* 思考内容预览 */}
        {step.thought && (
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate" title={step.thought}>
            💭 {step.thought}
          </div>
        )}
        {/* 执行的工具 */}
        {step.action && (
          <div className="text-xs text-blue-600 mt-0.5">
            ⚡ {step.action}
          </div>
        )}
      </div>
    </div>
  )
}

// SubAgent 进度展示组件
function SubAgentProgressPanel({ progress }: { progress: SubAgentProgress }) {
  const isRunning = progress.status === 'running' || progress.status === 'loading'
  const hasReActSteps = progress.currentNodeType === 'reactAgent' && progress.reactAgentSteps && progress.reactAgentSteps.length > 0

  // 计算进度百分比
  const totalNodes = progress.totalNodes ?? 0
  const completedNodes = progress.completedNodes ?? 0
  const progressPercent = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0

  return (
    <div className="border-t border-[var(--color-border-subtle)]">
      {/* 紧凑的单行进度栏：工作流名 + 状态 + 进度 + 当前节点 */}
      <div className="px-3 py-2 bg-[var(--color-bg-hover)] flex items-center gap-2">
        <Workflow className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
        <span className="text-xs text-[var(--color-text-muted)] font-medium truncate">
          {progress.workflowName}
        </span>
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded flex-shrink-0',
          progress.status === 'loading' && 'bg-yellow-500/10 text-yellow-600',
          progress.status === 'running' && 'bg-blue-500/10 text-blue-600',
          progress.status === 'completed' && 'bg-green-500/10 text-green-600',
          progress.status === 'error' && 'bg-red-500/10 text-red-600',
        )}>
          {subAgentStatusLabels[progress.status]}
        </span>
        {/* 节点进度 */}
        {totalNodes > 0 && (
          <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
            {completedNodes}/{totalNodes}
            {progressPercent > 0 && <span className="text-[var(--color-text-subtle)]">({progressPercent}%)</span>}
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
                    : 'bg-[var(--color-accent)]'
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

      {/* ReAct Agent 嵌套步骤展示 */}
      {hasReActSteps && (
        <div className="px-3 py-2 bg-[var(--color-bg-input)] border-t border-[var(--color-border-subtle)]">
          {/* ReAgent 标题 */}
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs text-blue-600 font-medium">ReAct Agent 步骤</span>
            {progress.reactAgentIteration !== undefined && progress.reactAgentMaxIterations !== undefined && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                ({progress.reactAgentIteration}/{progress.reactAgentMaxIterations})
              </span>
            )}
          </div>
          {/* 步骤列表 - 最多显示最近 3 个 */}
          <div className="space-y-1">
            {progress.reactAgentSteps!.slice(-3).map((step, index, arr) => (
              <ReActStepSummaryItem
                key={`${step.iteration}-${step.status}`}
                step={step}
                isLast={index === arr.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const ToolCallBlock = memo(function ToolCallBlock({
  toolCall,
  defaultExpanded = false,
  className,
  showParallelBadge,
  parallelIndex,
}: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const toolName = toolCall.toolName
  const status = toolCall.status
  const duration = toolCall.duration
  const subAgentProgress = toolCall.subAgentProgress

  // 判断 SubAgent 是否正在运行
  const isSubAgentRunning = subAgentProgress &&
    (subAgentProgress.status === 'running' || subAgentProgress.status === 'loading')

  // 判断是否有可展开的内容
  const hasExpandableContent = !!(toolCall.subAgentProgress || (toolCall.error && status === 'error'))

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
      {/* Header - 可点击展开（仅当有可展开内容时） */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 transition-colors',
          hasExpandableContent && 'cursor-pointer hover:bg-[var(--color-bg-hover)]'
        )}
        onClick={hasExpandableContent ? () => setExpanded(!expanded) : undefined}
      >
        <StatusIcon status={status} />
        {getToolIcon(toolName)}
        {/* 并行标识 */}
        {showParallelBadge && parallelIndex !== undefined && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 font-medium">
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
            subAgentProgress.status === 'loading' && 'bg-yellow-500/10 text-yellow-600',
            subAgentProgress.status === 'running' && 'bg-blue-500/10 text-blue-600',
            subAgentProgress.status === 'completed' && 'bg-green-500/10 text-green-600',
            subAgentProgress.status === 'error' && 'bg-red-500/10 text-red-600',
          )}>
            <Workflow className="w-3 h-3 flex-shrink-0" />
            {/* 工作流名称 + 进度 */}
            <span className="truncate max-w-[200px]">
              {subAgentProgress.workflowName}
              {subAgentProgress.totalNodes && subAgentProgress.totalNodes > 0 && (
                <span className="opacity-70 ml-1">
                  {subAgentProgress.completedNodes}/{subAgentProgress.totalNodes}
                </span>
              )}
            </span>
            {/* 当前运行时显示当前节点 */}
            {subAgentProgress.status === 'running' && subAgentProgress.currentNode && (
              <>
                <span className="opacity-70 truncate max-w-[120px]" title={subAgentProgress.currentNode}>
                  · {subAgentProgress.currentNode}
                </span>
                {/* 如果是 ReAct Agent，显示迭代进度 */}
                {subAgentProgress.currentNodeType === 'reactAgent' &&
                 subAgentProgress.reactAgentIteration !== undefined &&
                 subAgentProgress.reactAgentMaxIterations !== undefined && (
                  <span className="text-[10px] text-blue-600 flex-shrink-0" title={`ReAct Agent 迭代 ${subAgentProgress.reactAgentIteration}/${subAgentProgress.reactAgentMaxIterations}`}>
                    🧠{subAgentProgress.reactAgentIteration}/{subAgentProgress.reactAgentMaxIterations}
                  </span>
                )}
              </>
            )}
          </span>
        )}
        {/* 时长 */}
        {duration !== undefined && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {duration}ms
          </span>
        )}
        {/* 展开按钮 - 仅当有可展开内容时显示 */}
        {hasExpandableContent && (
          <ChevronDown
            className={cn(
              'w-4 h-4 ml-auto text-[var(--color-text-muted)] transition-transform',
              expanded && 'rotate-180'
            )}
          />
        )}
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
              <SubAgentProgressPanel progress={toolCall.subAgentProgress} />
            )}

            {/* 错误信息 */}
            {toolCall.error && status === 'error' && (
              <div className="px-3 py-2 border-t border-red-500/20 bg-red-500/5">
                <div className="text-xs text-red-500 mb-1">错误信息</div>
                <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">
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
