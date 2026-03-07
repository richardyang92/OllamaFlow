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
import { cn } from '@/lib/utils'
import type { ToolCallRecord, SubAgentProgress } from '@/store/agent-store'

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

// SubAgent 进度展示组件（简化版：只显示进度和当前节点）
function SubAgentProgressPanel({ progress }: { progress: SubAgentProgress }) {
  const isRunning = progress.status === 'running' || progress.status === 'loading'

  // 计算进度百分比
  const totalNodes = progress.totalNodes ?? 0
  const completedNodes = progress.completedNodes ?? 0
  const progressPercent = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0

  return (
    <div className="border-t border-[var(--color-border-subtle)]">
      {/* 进度状态栏 */}
      <div className="px-3 py-2 bg-purple-500/5 flex items-center gap-2">
        <Workflow className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-xs text-purple-400 font-medium">
          {progress.workflowName}
        </span>
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded',
          progress.status === 'loading' && 'bg-yellow-500/10 text-yellow-400',
          progress.status === 'running' && 'bg-blue-500/10 text-blue-400',
          progress.status === 'completed' && 'bg-green-500/10 text-green-400',
          progress.status === 'error' && 'bg-red-500/10 text-red-400',
        )}>
          {subAgentStatusLabels[progress.status]}
        </span>
        {isRunning && (
          <Loader2 className="w-3 h-3 text-blue-400 animate-spin ml-auto" />
        )}
      </div>

      {/* 节点执行进度条 */}
      {totalNodes > 0 && (
        <div className="px-3 py-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-input)]/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--color-text-muted)]">节点进度</span>
            <span className="text-xs font-medium text-purple-400">
              {completedNodes}/{totalNodes}
              {progressPercent > 0 && <span className="ml-1 text-[var(--color-text-muted)]">({progressPercent}%)</span>}
            </span>
          </div>
          {/* 进度条 */}
          <div className="h-1.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
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
        </div>
      )}

      {/* 当前节点 */}
      {progress.currentNode && (
        <div className="px-3 py-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-input)]/30">
          <div className="flex items-center gap-2 text-xs">
            {isRunning ? (
              <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
            ) : progress.status === 'completed' ? (
              <CheckCircle className="w-3 h-3 text-green-400" />
            ) : progress.status === 'error' ? (
              <XCircle className="w-3 h-3 text-red-400" />
            ) : (
              <Clock className="w-3 h-3 text-gray-400" />
            )}
            <span className="text-[var(--color-text-muted)]">当前节点:</span>
            <span className="text-[var(--color-text)] font-medium">{progress.currentNode}</span>
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

  // 如果 SubAgent 正在运行，自动展开
  useEffect(() => {
    if (isSubAgentRunning && !expanded) {
      setExpanded(true)
    }
  }, [isSubAgentRunning, expanded])

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
        {/* SubAgent 进度摘要 */}
        {subAgentProgress && (
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded ml-1',
            subAgentProgress.status === 'loading' && 'bg-yellow-500/10 text-yellow-400',
            subAgentProgress.status === 'running' && 'bg-blue-500/10 text-blue-400',
            subAgentProgress.status === 'completed' && 'bg-green-500/10 text-green-400',
            subAgentProgress.status === 'error' && 'bg-red-500/10 text-red-400',
          )}>
            {subAgentProgress.workflowName}
            {subAgentProgress.currentNode && subAgentProgress.status === 'running' && (
              <span className="ml-1 opacity-70">• {subAgentProgress.currentNode}</span>
            )}
          </span>
        )}
        {duration !== undefined && (
          <span className="text-xs text-[var(--color-text-muted)] ml-2">
            {duration}ms
          </span>
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
              <SubAgentProgressPanel progress={toolCall.subAgentProgress} />
            )}

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
