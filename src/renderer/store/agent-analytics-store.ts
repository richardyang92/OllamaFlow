/**
 * Agent 执行分析 Store
 * 管理 Agent 执行的实时指标收集和历史分析数据
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  AgentExecutionMetrics,
  AgentInsight,
  HistoricalComparison,
  MetricsUpdatePayload,
  IterationMetrics,
} from '@/types/analytics'

const DEBUG = false
const log = (...args: unknown[]) => DEBUG && console.log('[AgentAnalyticsStore]', ...args)

// ============ Store 状态接口 ============

interface AgentAnalyticsState {
  // 当前执行的实时指标
  currentMetrics: Map<string, AgentExecutionMetrics>

  // 历史执行记录（用于对比分析）
  history: HistoricalComparison[]

  // ========== Actions ==========

  // 初始化新的执行分析
  initExecution: (nodeId: string, executionId: string, query: string, maxIterations: number) => void

  // 更新指标
  updateMetrics: (payload: MetricsUpdatePayload) => void

  // 完成执行分析
  completeExecution: (nodeId: string, success: boolean) => void

  // 获取当前执行的分析数据
  getMetrics: (nodeId: string) => AgentExecutionMetrics | null

  // 通过 executionId 获取分析数据
  getMetricsByExecutionId: (executionId: string) => AgentExecutionMetrics | null

  // 获取所有历史记录
  getHistory: () => HistoricalComparison[]

  // 获取特定查询类型的历史记录
  getHistoryByQuery: (queryPattern: string) => HistoricalComparison[]

  // 清除执行数据
  clearExecution: (nodeId: string) => void

  // 清除所有历史
  clearHistory: () => void

  // 加载历史记录
  loadHistory: () => Promise<void>

  // 保存历史记录
  saveHistory: () => Promise<void>
}

// ============ ID 生成器 ============

let insightIdCounter = 0
const generateInsightId = () => `insight_${Date.now()}_${++insightIdCounter}`

// ============ 辅助函数 ============

/**
 * 生成洞察建议
 */
function generateInsights(metrics: AgentExecutionMetrics): AgentInsight[] {
  const insights: AgentInsight[] = []

  // 效率洞察
  if (metrics.efficiency.efficiency < 50) {
    insights.push({
      id: generateInsightId(),
      type: 'efficiency',
      severity: 'warning',
      title: '迭代效率较低',
      message: `当前迭代效率为 ${metrics.efficiency.efficiency}%，建议优化提示词以减少不必要的迭代`,
      actionable: true,
      action: {
        label: '优化提示词',
        type: 'optimize_prompt',
      },
    })
  }

  // 工具使用洞察
  const slowTools = metrics.toolUsage.tools.filter((t) => t.avgDuration > 3000)
  if (slowTools.length > 0) {
    insights.push({
      id: generateInsightId(),
      type: 'bottleneck',
      severity: 'warning',
      title: '工具调用耗时较长',
      message: `${slowTools.map((t) => t.toolName).join(', ')} 平均耗时超过3秒，建议检查网络或优化工具`,
      actionable: true,
      action: {
        label: '查看详情',
        type: 'review_code',
      },
    })
  }

  // 思考质量洞察
  if (metrics.thinkingQuality.redundantThoughts.length > 0) {
    insights.push({
      id: generateInsightId(),
      type: 'quality',
      severity: 'info',
      title: '发现重复思考',
      message: `检测到 ${metrics.thinkingQuality.redundantThoughts.length} 次相似思考，建议优化思考策略`,
      actionable: true,
      action: {
        label: '优化提示词',
        type: 'optimize_prompt',
      },
    })
  }

  // 成功完成洞察
  if (metrics.status === 'completed' && metrics.overallScore > 80) {
    insights.push({
      id: generateInsightId(),
      type: 'suggestion',
      severity: 'info',
      title: '执行效率优秀',
      message: `本次执行综合评分为 ${metrics.overallScore} 分，可作为最佳实践参考`,
      actionable: false,
    })
  }

  return insights
}

/**
 * 计算综合评分
 */
function calculateOverallScore(metrics: AgentExecutionMetrics): number {
  const efficiencyWeight = 0.4
  const qualityWeight = 0.3
  const toolWeight = 0.3

  const efficiencyScore = metrics.efficiency.efficiency
  const qualityScore = metrics.thinkingQuality.qualityScore
  const toolScore = metrics.toolUsage.successRate * 100

  return Math.round(efficiencyScore * efficiencyWeight + qualityScore * qualityWeight + toolScore * toolWeight)
}

// ============ Store 实现 ============

export const useAgentAnalyticsStore = create<AgentAnalyticsState>()(
  immer((set, get) => ({
    // 初始状态
    currentMetrics: new Map(),
    history: [],

    // ========== Actions ==========

    initExecution: (nodeId, executionId, query, maxIterations) => {
      log('initExecution', { nodeId, executionId, query, maxIterations })

      const initialMetrics: AgentExecutionMetrics = {
        executionId,
        nodeId,
        timestamp: Date.now(),
        query,
        efficiency: {
          totalDuration: 0,
          pureThinkingTime: 0,
          toolWaitTime: 0,
          overheadTime: 0,
          phaseTimings: [],
          iterationMetrics: [],
          targetIterations: maxIterations,
          actualIterations: 0,
          efficiency: 0,
        },
        toolUsage: {
          tools: [],
          parallelization: {
            maxConcurrent: 0,
            parallelCallCount: 0,
            sequentialCallCount: 0,
            parallelSavings: 0,
          },
          totalCalls: 0,
          successRate: 0,
        },
        thinkingQuality: {
          avgThoughtLength: 0,
          thoughtLengthTrend: [],
          redundantThoughts: [],
          backtracks: [],
          qualityScore: 0,
        },
        decisionPath: {
          criticalPath: [],
          decisionPoints: [],
          bottlenecks: [],
        },
        insights: [],
        overallScore: 0,
        status: 'running',
      }

      set((state) => {
        state.currentMetrics.set(nodeId, initialMetrics)
      })
    },

    updateMetrics: (payload) => {
      log('updateMetrics', payload)

      set((state) => {
        const metrics = state.currentMetrics.get(payload.nodeId)
        if (!metrics) return

        switch (payload.type) {
          case 'thinking_start':
            // 记录思考开始时间
            ;(payload.data as { startTime: number }).startTime = payload.timestamp
            break

          case 'thinking_end': {
            // 计算思考耗时
            const data = payload.data as {
              startTime: number
              thought: string
              iteration: number
            }
            const duration = payload.timestamp - data.startTime
            const thoughtLength = data.thought?.length || 0

            // 更新迭代指标
            const iterationMetric: IterationMetrics = {
              iteration: data.iteration,
              thinkingTime: duration,
              toolTime: 0,
              observationTime: 0,
              totalTime: duration,
              thoughtLength,
              toolCount: 0,
            }

            metrics.efficiency.iterationMetrics.push(iterationMetric)
            metrics.efficiency.pureThinkingTime += duration
            metrics.thinkingQuality.thoughtLengthTrend.push(thoughtLength)

            // 检查冗余思考
            if (metrics.efficiency.iterationMetrics.length > 1) {
              // TODO: 实现冗余思考检测
              // 需要存储完整的 thought 文本才能计算相似度
              // const prevMetrics = metrics.efficiency.iterationMetrics.slice(0, -1)
            }
            break
          }

          case 'tool_start': {
            // 记录工具调用开始
            const data = payload.data as { toolId: string; toolName: string }
            let toolMetric = metrics.toolUsage.tools.find((t) => t.toolId === data.toolId)

            if (!toolMetric) {
              toolMetric = {
                toolId: data.toolId,
                toolName: data.toolName,
                callCount: 0,
                successCount: 0,
                failCount: 0,
                avgDuration: 0,
                minDuration: Infinity,
                maxDuration: 0,
                totalDuration: 0,
              }
              metrics.toolUsage.tools.push(toolMetric)
            }

            toolMetric.callCount++
            ;(payload.data as { startTime: number }).startTime = payload.timestamp
            break
          }

          case 'tool_end': {
            // 计算工具调用耗时
            const data = payload.data as {
              toolId: string
              startTime: number
              success: boolean
            }
            const duration = payload.timestamp - data.startTime

            const toolMetric = metrics.toolUsage.tools.find((t) => t.toolId === data.toolId)
            if (toolMetric) {
              toolMetric.totalDuration += duration
              toolMetric.avgDuration = toolMetric.totalDuration / toolMetric.callCount
              toolMetric.minDuration = Math.min(toolMetric.minDuration, duration)
              toolMetric.maxDuration = Math.max(toolMetric.maxDuration, duration)

              if (data.success) {
                toolMetric.successCount++
              } else {
                toolMetric.failCount++
              }
            }

            metrics.efficiency.toolWaitTime += duration
            metrics.toolUsage.totalCalls++

            // 更新成功率
            const totalCalls = metrics.toolUsage.totalCalls
            const successCalls = metrics.toolUsage.tools.reduce((sum, t) => sum + t.successCount, 0)
            metrics.toolUsage.successRate = totalCalls > 0 ? successCalls / totalCalls : 0
            break
          }

          case 'iteration_complete': {
            // 完成一次迭代
            metrics.efficiency.actualIterations++

            // 计算当前效率
            const actual = metrics.efficiency.actualIterations
            const target = metrics.efficiency.targetIterations
            metrics.efficiency.efficiency = Math.round((target / Math.max(actual, 1)) * 100)

            // 计算平均思考长度
            if (metrics.thinkingQuality.thoughtLengthTrend.length > 0) {
              const total = metrics.thinkingQuality.thoughtLengthTrend.reduce((a, b) => a + b, 0)
              metrics.thinkingQuality.avgThoughtLength = Math.round(total / metrics.thinkingQuality.thoughtLengthTrend.length)
            }
            break
          }

          case 'execution_complete': {
            // 计算总耗时
            metrics.efficiency.totalDuration = payload.timestamp - metrics.timestamp
            metrics.efficiency.overheadTime =
              metrics.efficiency.totalDuration -
              metrics.efficiency.pureThinkingTime -
              metrics.efficiency.toolWaitTime

            // 计算阶段分布
            const total = metrics.efficiency.totalDuration
            metrics.efficiency.phaseTimings = [
              {
                phase: 'thinking',
                duration: metrics.efficiency.pureThinkingTime,
                percentage: total > 0 ? Math.round((metrics.efficiency.pureThinkingTime / total) * 100) : 0,
              },
              {
                phase: 'acting',
                duration: metrics.efficiency.toolWaitTime,
                percentage: total > 0 ? Math.round((metrics.efficiency.toolWaitTime / total) * 100) : 0,
              },
              {
                phase: 'other',
                duration: metrics.efficiency.overheadTime,
                percentage: total > 0 ? Math.round((metrics.efficiency.overheadTime / total) * 100) : 0,
              },
            ]

            // 计算质量分数（简化版）
            const redundancyPenalty = metrics.thinkingQuality.redundantThoughts.length * 10
            const backtrackPenalty = metrics.thinkingQuality.backtracks.length * 15
            metrics.thinkingQuality.qualityScore = Math.max(0, 100 - redundancyPenalty - backtrackPenalty)

            // 生成洞察
            metrics.insights = generateInsights(metrics)

            // 计算综合评分
            metrics.overallScore = calculateOverallScore(metrics)
            break
          }
        }
      })
    },

    completeExecution: (nodeId, success) => {
      log('completeExecution', { nodeId, success })

      set((state) => {
        const metrics = state.currentMetrics.get(nodeId)
        if (!metrics) return

        metrics.status = success ? 'completed' : 'failed'

        // Check if this executionId already exists in history
        const existingIndex = state.history.findIndex(h => h.executionId === metrics.executionId)
        
        // 添加到历史记录（避免重复）
        const historicalRecord: HistoricalComparison = {
          executionId: metrics.executionId,
          timestamp: metrics.timestamp,
          query: metrics.query,
          duration: metrics.efficiency.totalDuration,
          iterationCount: metrics.efficiency.actualIterations,
          toolCallCount: metrics.toolUsage.totalCalls,
          success,
          overallScore: metrics.overallScore,
        }

        if (existingIndex >= 0) {
          // Update existing record instead of adding duplicate
          state.history[existingIndex] = historicalRecord
        } else {
          // Add new record
          state.history.unshift(historicalRecord)
        }

        // 只保留最近 50 条记录
        if (state.history.length > 50) {
          state.history = state.history.slice(0, 50)
        }
      })

      // 自动保存到持久化存储
      const state = get()
      window.electronAPI.analytics.saveHistory(state.history).catch((error: unknown) => {
        console.error('[AgentAnalyticsStore] Failed to save history:', error)
      })
    },

    getMetrics: (nodeId) => {
      return get().currentMetrics.get(nodeId) || null
    },

    getMetricsByExecutionId: (executionId) => {
      // 遍历 currentMetrics 查找匹配的 executionId
      for (const metrics of get().currentMetrics.values()) {
        if (metrics.executionId === executionId) {
          return metrics
        }
      }
      return null
    },

    getHistory: () => {
      return get().history
    },

    getHistoryByQuery: (queryPattern) => {
      const pattern = queryPattern.toLowerCase()
      return get().history.filter((h) => h.query.toLowerCase().includes(pattern))
    },

    clearExecution: (nodeId) => {
      log('clearExecution', nodeId)
      set((state) => {
        state.currentMetrics.delete(nodeId)
      })
    },

    clearHistory: () => {
      log('clearHistory')
      set((state) => {
        state.history = []
      })
      // 清除持久化存储
      window.electronAPI.analytics.clearHistory().catch((error) => {
        console.error('[AgentAnalyticsStore] Failed to clear history:', error)
      })
    },

    loadHistory: async () => {
      try {
        log('loadHistory - starting')
        const history = await window.electronAPI.analytics.getHistory()
        if (history) {
          set((state) => {
            state.history = history
          })
          log('loadHistory - loaded', history.length, 'records')
        }
      } catch (error) {
        console.error('[AgentAnalyticsStore] loadHistory error:', error)
      }
    },

    saveHistory: async () => {
      try {
        const state = get()
        await window.electronAPI.analytics.saveHistory(state.history)
        log('saveHistory - saved', state.history.length, 'records')
      } catch (error) {
        console.error('[AgentAnalyticsStore] saveHistory error:', error)
      }
    },

    exportReport: (nodeId) => {
      const metrics = get().currentMetrics.get(nodeId)
      if (!metrics) {
        return JSON.stringify({ error: 'No metrics found' }, null, 2)
      }

      const report = {
        summary: {
          query: metrics.query,
          duration: `${(metrics.efficiency.totalDuration / 1000).toFixed(2)}s`,
          iterations: `${metrics.efficiency.actualIterations}/${metrics.efficiency.targetIterations}`,
          toolCalls: metrics.toolUsage.totalCalls,
          successRate: `${(metrics.toolUsage.successRate * 100).toFixed(1)}%`,
          overallScore: metrics.overallScore,
        },
        efficiency: metrics.efficiency,
        toolUsage: metrics.toolUsage,
        thinkingQuality: metrics.thinkingQuality,
        insights: metrics.insights,
        generatedAt: new Date().toISOString(),
      }

      return JSON.stringify(report, null, 2)
    },
  })),
)
