/**
 * SubAgent 详情面板组件
 * 在右侧侧边面板中展示 SubAgent 的完整节点执行步骤（时间线形式）
 */

import { memo, useMemo, useRef, useEffect, useState } from 'react'
import { useAgentStore } from '@/store/agent-store'
import { AgentStepBlock } from './AgentStepBlock'
import type { SubAgentProgress } from '@/store/agent-store'
import {
  CheckCircle,
  XCircle,
  Loader2,
  X,
  Circle,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Brain,
  ArrowDownCircle,
  ArrowUpCircle,
  Globe,
  FileText,
  Settings,
  Zap,
  GitBranch,
  Repeat,
  Clock,
  Code,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubAgentDetailsDrawerProps {
  onClose?: () => void
}

// 节点类型图标映射
const nodeTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  input: ArrowDownCircle,
  output: ArrowUpCircle,
  ollamaChat: MessageCircle,
  reactAgent: Brain,
  httpRequest: Globe,
  readFile: FileText,
  writeFile: FileText,
  set: Settings,
  if: GitBranch,
  loop: Repeat,
  delay: Clock,
  json: Code,
  splitter: Zap,
  join: Zap,
  smartRouter: GitBranch,
  plan: Brain,
  queue: Zap,
}

// 从 store 中解析 SubAgent 数据
// key 格式: "{messageId}|{stepId}|{toolCallId}" (使用 | 分隔符避免与 ID 中的 _ 冲突)
function resolveSubAgentData(
  subAgentKey: string | null,
  messages: ReturnType<typeof useAgentStore.getState>['messages']
): {
  progress: SubAgentProgress | null
  keyParts: { messageId: string; stepId: string; toolCallId: string } | null
} {
  if (!subAgentKey) {
    return { progress: null, keyParts: null }
  }

  // 使用 | 分隔符，因为 ID 中包含 _ (如 msg_xxx_yyy)
  const parts = subAgentKey.split('|')
  if (parts.length !== 3) {
    return { progress: null, keyParts: null }
  }

  const [messageId, stepId, toolCallId] = parts
  const message = messages.find(m => m.id === messageId)

  if (!message) return { progress: null, keyParts: null }

  const step = message.steps?.find(s => s.id === stepId)
  if (!step) return { progress: null, keyParts: null }

  // 优先从并行工具调用中查找
  let toolCall = step.toolCalls?.find(tc => tc.id === toolCallId)
  if (!toolCall && step.toolCall?.id === toolCallId) {
    toolCall = step.toolCall
  }

  if (!toolCall?.subAgentProgress) {
    return { progress: null, keyParts: null }
  }

  return {
    progress: toolCall.subAgentProgress,
    keyParts: { messageId, stepId, toolCallId }
  }
}

// 格式化时长
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// 时间线节点组件
interface TimelineNodeProps {
  nodeStep: SubAgentProgress['nodeSteps'][0]
  isLast: boolean
  isRunning: boolean
  isExpanded: boolean
  onToggle: () => void
}

const TimelineNode = memo(function TimelineNode({
  nodeStep,
  isLast,
  isRunning,
  isExpanded,
  onToggle,
}: TimelineNodeProps) {
  // 状态图标和颜色
  const getStatusConfig = () => {
    switch (nodeStep.status) {
      case 'pending':
        return {
          icon: Circle,
          iconClass: 'text-gray-400',
          borderClass: 'border-gray-500/30',
          bgClass: 'bg-gray-500/10',
        }
      case 'running':
        return {
          icon: Loader2,
          iconClass: 'text-blue-400 animate-spin',
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

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig.icon
  const NodeTypeIcon = nodeTypeIcons[nodeStep.nodeType] || Circle

  // 计算执行时长
  const duration = nodeStep.endTime
    ? formatDuration(nodeStep.endTime - nodeStep.startTime)
    : isRunning && nodeStep.status === 'running'
      ? formatDuration(Date.now() - nodeStep.startTime)
      : null

  // 转换为 AgentStep 格式
  const agentStep = {
    id: nodeStep.id,
    iteration: 0,
    status: (nodeStep.status === 'pending' ? 'thinking'
      : nodeStep.status === 'running' ? 'acting'
      : nodeStep.status === 'completed' ? 'completed'
      : 'error') as 'thinking' | 'acting' | 'completed' | 'error',
    thought: nodeStep.thought,
    thoughtStreaming: nodeStep.thoughtStreaming,
    observation: nodeStep.observation,
    observationStreaming: nodeStep.observationStreaming,
    startedAt: nodeStep.startTime,
    completedAt: nodeStep.endTime,
  }

  return (
    <div className="relative">
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

      {/* 节点内容 */}
      <div className="pl-8 pb-4">
        {/* 节点标题行 */}
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center gap-2 py-1 px-2 -ml-2 rounded-md',
            'hover:bg-[var(--color-bg-input)]/50',
            'transition-colors text-left'
          )}
        >
          {/* 展开/收起图标 */}
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
          )}

          {/* 节点类型图标 */}
          <NodeTypeIcon className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />

          {/* 节点名称 */}
          <span className="text-xs font-medium text-[var(--color-text)] truncate flex-1">
            {nodeStep.nodeName}
          </span>

          {/* 执行时长 */}
          {duration && (
            <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
              {duration}
            </span>
          )}
        </button>

        {/* 展开后的详情 */}
        {isExpanded && (
          <div className="mt-1">
            <AgentStepBlock
              step={agentStep}
              isLast={isLast}
              nodeLabel={nodeStep.nodeName}
              nodeType={nodeStep.nodeType}
              errorMessage={nodeStep.error}
              reactAgentSteps={nodeStep.reactAgentSteps}
              isRunning={isRunning && nodeStep.status === 'running'}
              defaultExpanded={true}
              forceCollapsed={false}
              className="!border-l-0 !ml-0 !pl-0 !mt-0"
            />
          </div>
        )}
      </div>
    </div>
  )
})

export const SubAgentDetailsDrawer = memo(function SubAgentDetailsDrawer({
  onClose,
}: SubAgentDetailsDrawerProps = {}) {
  const { selectedSubAgentKey, messages } = useAgentStore()
  const contentRef = useRef<HTMLDivElement>(null)

  // 展开状态管理
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // 解析 SubAgent 数据
  const { progress, keyParts } = useMemo(
    () => resolveSubAgentData(selectedSubAgentKey, messages),
    [selectedSubAgentKey, messages]
  )

  // 没有数据时仍然渲染面板，但显示空状态
  const hasData = progress && keyParts
  const nodeSteps = progress?.nodeSteps || []

  // 自动展开正在运行或有错误的节点
  useEffect(() => {
    if (!hasData || nodeSteps.length === 0) return

    const newExpanded = new Set(expandedNodes)

    nodeSteps.forEach((nodeStep, index) => {
      // 自动展开：正在运行、刚完成、或有错误的节点
      if (
        nodeStep.status === 'running' ||
        nodeStep.status === 'error' ||
        (nodeStep.status === 'completed' && index === nodeSteps.length - 1)
      ) {
        newExpanded.add(nodeStep.id)
      }
    })

    if (newExpanded.size !== expandedNodes.size) {
      setExpandedNodes(newExpanded)
    }
  }, [hasData, nodeSteps])

  // 自动滚动到底部（当内容更新时）
  useEffect(() => {
    if (contentRef.current && hasData) {
      // 检查是否有正在进行的流式输出
      const hasStreaming = progress?.nodeSteps?.some(step =>
        step.thoughtStreaming || step.observationStreaming
      )

      // 只有在有流式输出或新节点时才自动滚动
      if (hasStreaming || (progress?.status === 'running' || progress?.status === 'loading')) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight
      }
    }
  }, [progress, hasData, messages])

  // 切换节点展开状态
  const toggleNodeExpanded = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  const isRunning = progress?.status === 'running' || progress?.status === 'loading'

  return (
    <div className="h-full flex flex-col">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {!hasData ? (
            <>
              <h2 className="text-sm font-medium text-[var(--color-text)]">未选择 SubAgent</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                点击工具调用卡片上的「查看详情」按钮
              </p>
            </>
          ) : (
            <>
              <h2 className="text-sm font-medium text-[var(--color-text)] truncate">
                {progress.workflowName}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                {progress.completedNodes ?? 0}/{progress.totalNodes ?? 0} 节点 • {formatDuration(progress.updatedAt - progress.startedAt)}
              </p>
            </>
          )}
        </div>
        {/* 关闭按钮 */}
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              'flex-shrink-0 ml-2',
              'w-6 h-6 flex items-center justify-center',
              'rounded-full',
              'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              'hover:bg-[var(--color-bg-input)]',
              'transition-all'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 状态指示器 - 仅在有数据时显示 */}
      {hasData && (
        <div className="px-4 py-2 border-b border-[var(--color-border-subtle)] flex items-center gap-2">
          {progress.status === 'loading' && (
            <>
              <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
              <span className="text-xs text-yellow-400">加载中</span>
            </>
          )}
          {progress.status === 'running' && (
            <>
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              <span className="text-xs text-blue-400">执行中</span>
            </>
          )}
          {progress.status === 'completed' && (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-400">已完成</span>
            </>
          )}
          {progress.status === 'error' && (
            <>
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-400">执行失败</span>
            </>
          )}
          {progress.currentNode && (
            <>
              <span className="text-[var(--color-border)]">•</span>
              <span className="text-xs text-[var(--color-text-muted)] truncate">{progress.currentNode}</span>
            </>
          )}
        </div>
      )}

      {/* 节点步骤时间线 */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-3">
        {!hasData ? (
          <div className="text-xs text-[var(--color-text-muted)] text-center py-8">
            请选择一个 SubAgent 查看详情
          </div>
        ) : nodeSteps.length === 0 ? (
          <div className="text-xs text-[var(--color-text-muted)] text-center py-8">
            {isRunning ? '等待节点执行...' : '暂无节点步骤'}
          </div>
        ) : (
          <div className="relative">
            {/* 左侧连接线 */}
            <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-[var(--color-border-subtle)]" />

            {/* 节点列表 */}
            {nodeSteps.map((nodeStep, index) => (
              <TimelineNode
                key={nodeStep.id}
                nodeStep={nodeStep}
                isLast={index === nodeSteps.length - 1}
                isRunning={isRunning}
                isExpanded={expandedNodes.has(nodeStep.id)}
                onToggle={() => toggleNodeExpanded(nodeStep.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

export default SubAgentDetailsDrawer
