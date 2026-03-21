/**
 * Agent 分析 Hook
 * 将 Agent 执行数据连接到分析系统
 */

import { useEffect, useRef } from 'react'
import { useAgentAnalyticsStore } from '@/store/agent-analytics-store'
import type { ReActExecutionState } from '@/types/node'

interface UseAgentAnalyticsOptions {
  nodeId: string
  reactState: ReActExecutionState | null | undefined
  query: string
  maxIterations: number
}

export function useAgentAnalytics({ nodeId, reactState, query, maxIterations }: UseAgentAnalyticsOptions) {
  const analyticsStore = useAgentAnalyticsStore()
  const initializedRef = useRef(false)
  const executionIdRef = useRef<string>('')

  // 初始化分析
  useEffect(() => {
    if (!reactState || initializedRef.current) return

    // 生成执行 ID
    executionIdRef.current = `exec-${nodeId}-${Date.now()}`

    // 初始化执行分析
    analyticsStore.initExecution(nodeId, executionIdRef.current, query, maxIterations)
    initializedRef.current = true

    return () => {
      // 清理
      if (executionIdRef.current) {
        analyticsStore.clearExecution(nodeId)
      }
    }
  }, [nodeId, query, maxIterations, reactState, analyticsStore])

  // 监听步骤变化，更新分析数据
  useEffect(() => {
    if (!reactState?.steps?.length || !executionIdRef.current) return

    const latestStep = reactState.steps[reactState.steps.length - 1]
    const executionId = executionIdRef.current

    // 根据步骤状态更新分析
    switch (latestStep.status) {
      case 'thinking': {
        if (latestStep.thought && !latestStep.thoughtStreaming) {
          // 思考完成
          analyticsStore.updateMetrics({
            nodeId,
            executionId,
            type: 'thinking_end',
            timestamp: Date.now(),
            data: {
              startTime: latestStep.startedAt,
              thought: latestStep.thought,
              iteration: latestStep.iteration,
            },
          })
        } else if (latestStep.thoughtStreaming && latestStep.thought) {
          // 思考开始
          analyticsStore.updateMetrics({
            nodeId,
            executionId,
            type: 'thinking_start',
            timestamp: latestStep.startedAt,
            data: {},
          })
        }
        break
      }

      case 'acting': {
        // 工具调用开始
        if (latestStep.action) {
          const toolName = latestStep.action.split(',')[0].trim()
          analyticsStore.updateMetrics({
            nodeId,
            executionId,
            type: 'tool_start',
            timestamp: Date.now(),
            data: {
              toolId: toolName.toLowerCase(),
              toolName,
            },
          })
        }
        break
      }

      case 'observing': {
        // 观察完成（工具调用结束）
        if (latestStep.observation && !latestStep.observationStreaming) {
          analyticsStore.updateMetrics({
            nodeId,
            executionId,
            type: 'tool_end',
            timestamp: Date.now(),
            data: {
              toolId: latestStep.action?.split(',')[0].trim().toLowerCase() || 'unknown',
              startTime: latestStep.startedAt,
              success: !latestStep.observationError,
            },
          })

          // 迭代完成
          analyticsStore.updateMetrics({
            nodeId,
            executionId,
            type: 'iteration_complete',
            timestamp: Date.now(),
            data: {},
          })
        }
        break
      }

      case 'completed': {
        // 执行完成
        if (!reactState.isRunning && reactState.finalAnswer) {
          analyticsStore.updateMetrics({
            nodeId,
            executionId,
            type: 'execution_complete',
            timestamp: Date.now(),
            data: {},
          })
          analyticsStore.completeExecution(nodeId, true)
        }
        break
      }
    }
  }, [nodeId, reactState, analyticsStore])

  return {
    executionId: executionIdRef.current,
  }
}
