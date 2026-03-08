/**
 * SubAgent 详情抽屉组件
 * 在右侧抽屉中展示 SubAgent 的完整节点执行步骤
 */

import { memo, useMemo, useRef, useEffect } from 'react'
import { CollapsibleDrawer, DrawerContent } from '@/components/ui/CollapsibleDrawer'
import { useAgentStore } from '@/store/agent-store'
import { AgentStepBlock } from './AgentStepBlock'
import type { SubAgentProgress } from '@/store/agent-store'
import { Workflow, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubAgentDetailsDrawerProps {
  isOpen: boolean
  onClose: () => void
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

export const SubAgentDetailsDrawer = memo(function SubAgentDetailsDrawer({
  isOpen,
  onClose,
}: SubAgentDetailsDrawerProps) {
  const { selectedSubAgentKey, messages } = useAgentStore()
  const contentRef = useRef<HTMLDivElement>(null)

  // 解析 SubAgent 数据
  const { progress, keyParts } = useMemo(
    () => resolveSubAgentData(selectedSubAgentKey, messages),
    [selectedSubAgentKey, messages]
  )

  // 没有数据时仍然渲染抽屉，但显示空状态
  const hasData = progress && keyParts

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

  return (
    <CollapsibleDrawer
      isOpen={isOpen}
      onClose={onClose}
      side="right"
      width={480}
      minWidth={320}
      maxWidth={640}
    >
      {!hasData ? (
        // 空状态
        <>
          {/* 标题栏 - 自定义以避开关闭按钮 */}
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] pl-10">
            <h2 className="text-sm font-medium text-[var(--color-text)]">未选择 SubAgent</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              点击工具调用卡片上的「查看详情」按钮查看详情
            </p>
          </div>
          <DrawerContent>
            <div className="text-xs text-[var(--color-text-muted)] text-center py-8">
              请选择一个 SubAgent 查看详情
            </div>
          </DrawerContent>
        </>
      ) : (
        // 有数据时显示详情
        <>
          {/* 标题栏 - 自定义以避开关闭按钮 */}
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] pl-10">
            <h2 className="text-sm font-medium text-[var(--color-text)] truncate">
              {progress.workflowName}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
              {progress.completedNodes ?? 0}/{progress.totalNodes ?? 0} 节点 • {formatDuration(progress.updatedAt - progress.startedAt)}
            </p>
          </div>

          {/* 状态指示器 */}
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
                <span className="text-xs text-[var(--color-text-muted)]">{progress.currentNode}</span>
              </>
            )}
          </div>

          {/* 节点步骤列表 */}
          <DrawerContent className="p-3" contentRef={contentRef}>
            {(!progress.nodeSteps || progress.nodeSteps.length === 0) ? (
              <div className="text-xs text-[var(--color-text-muted)] text-center py-8">
                {(progress.status === 'running' || progress.status === 'loading') ? '等待节点执行...' : '暂无节点步骤'}
              </div>
            ) : (
              <div className="space-y-1">
                {progress.nodeSteps.map((nodeStep, index) => {
                  // 转换为 AgentStep 格式以复用 AgentStepBlock
                  const agentStep = {
                    id: nodeStep.id,
                    iteration: 0,
                    status: nodeStep.status === 'pending' ? 'thinking'
                      : nodeStep.status === 'running' ? 'acting'
                      : nodeStep.status === 'completed' ? 'completed'
                      : 'error' as const,
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
                      isLast={index === progress.nodeSteps!.length - 1}
                      nodeLabel={nodeStep.nodeName}
                      nodeType={nodeStep.nodeType}
                      errorMessage={nodeStep.error}
                      reactAgentSteps={nodeStep.reactAgentSteps}
                      isRunning={progress.status === 'running' || progress.status === 'loading'}
                      // 默认展开：正在运行、刚完成、或有错误的节点
                      defaultExpanded={
                        nodeStep.status === 'running' ||
                        nodeStep.status === 'loading' ||
                        (nodeStep.status === 'completed' && index === progress.nodeSteps!.length - 1) ||
                        nodeStep.status === 'error'
                      }
                      className="!border-l-0 !ml-0 !pl-4"
                    />
                  )
                })}
              </div>
            )}
          </DrawerContent>
        </>
      )}
    </CollapsibleDrawer>
  )
})

export default SubAgentDetailsDrawer
