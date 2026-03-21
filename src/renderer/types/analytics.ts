/**
 * Agent 执行分析类型定义
 */

// ============ 执行效率指标 ============

export interface ExecutionPhaseTiming {
  phase: 'thinking' | 'acting' | 'observing' | 'other'
  duration: number
  percentage: number
}

export interface IterationMetrics {
  iteration: number
  thinkingTime: number
  toolTime: number
  observationTime: number
  totalTime: number
  thoughtLength: number
  toolCount: number
}

export interface ExecutionEfficiencyMetrics {
  totalDuration: number
  pureThinkingTime: number
  toolWaitTime: number
  overheadTime: number
  phaseTimings: ExecutionPhaseTiming[]
  iterationMetrics: IterationMetrics[]
  targetIterations: number
  actualIterations: number
  efficiency: number // 0-100
}

// ============ 工具使用指标 ============

export interface ToolCallMetrics {
  toolId: string
  toolName: string
  callCount: number
  successCount: number
  failCount: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  totalDuration: number
}

export interface ToolParallelizationMetrics {
  maxConcurrent: number
  parallelCallCount: number
  sequentialCallCount: number
  parallelSavings: number // 节省的时间
}

export interface ToolUsageMetrics {
  tools: ToolCallMetrics[]
  parallelization: ToolParallelizationMetrics
  totalCalls: number
  successRate: number
}

// ============ 思考质量指标 ============

export interface RedundantThought {
  stepId: string
  iteration: number
  similarity: number // 0-1
  similarTo: string // 相似的思考 ID
  reason: string
}

export interface BacktrackRecord {
  fromStep: string
  toStep: string
  fromIteration: number
  toIteration: number
  reason: 'insufficient_info' | 'wrong_direction' | 'error_recovery' | 'other'
}

export interface ThinkingQualityMetrics {
  avgThoughtLength: number
  thoughtLengthTrend: number[]
  redundantThoughts: RedundantThought[]
  backtracks: BacktrackRecord[]
  qualityScore: number // 0-100
}

// ============ 决策路径指标 ============

export interface Bottleneck {
  stepId: string
  iteration: number
  type: 'thinking' | 'tool_wait' | 'retry' | 'error_recovery'
  impact: number // 对总耗时的影响（秒）
  description: string
}

export interface DecisionPoint {
  stepId: string
  iteration: number
  decision: string
  alternatives: string[]
  confidence?: number
}

export interface DecisionPathMetrics {
  criticalPath: string[] // 关键步骤 ID
  decisionPoints: DecisionPoint[]
  bottlenecks: Bottleneck[]
}

// ============ 综合分析指标 ============

export type InsightSeverity = 'info' | 'warning' | 'critical'
export type InsightType = 'efficiency' | 'quality' | 'bottleneck' | 'suggestion'

export interface AgentInsight {
  id: string
  type: InsightType
  severity: InsightSeverity
  title: string
  message: string
  data?: unknown
  actionable: boolean
  action?: {
    label: string
    type: 'optimize_prompt' | 'adjust_config' | 'review_code' | 'none'
  }
}

export interface AgentExecutionMetrics {
  executionId: string
  nodeId: string
  timestamp: number
  query: string // 用户查询（用于历史对比）

  // 核心指标
  efficiency: ExecutionEfficiencyMetrics
  toolUsage: ToolUsageMetrics
  thinkingQuality: ThinkingQualityMetrics
  decisionPath: DecisionPathMetrics

  // 洞察
  insights: AgentInsight[]

  // 综合评分
  overallScore: number // 0-100
  status: 'running' | 'completed' | 'failed'
}

// ============ 历史对比指标 ============

export interface HistoricalComparison {
  executionId: string
  timestamp: number
  query: string
  duration: number
  iterationCount: number
  toolCallCount: number
  success: boolean
  overallScore: number
}

export interface AgentAnalytics {
  currentExecution: AgentExecutionMetrics | null
  history: HistoricalComparison[]
}

// ============ 实时更新数据 ============

export interface MetricsUpdatePayload {
  nodeId: string
  executionId: string
  type: 'thinking_start' | 'thinking_end' | 'tool_start' | 'tool_end' | 'iteration_complete' | 'execution_complete'
  timestamp: number
  data?: unknown
}
