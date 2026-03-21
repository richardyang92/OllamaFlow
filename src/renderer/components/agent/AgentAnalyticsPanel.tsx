/**
 * Agent 执行分析面板
 * 展示 Agent 执行的效率、工具使用、思考质量等分析数据
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Clock,
  Zap,
  Wrench,
  Brain,
  Target,
  Download,
  X,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { useAgentAnalyticsStore } from '@/store/agent-analytics-store'
import type { AgentInsight, AgentExecutionMetrics } from '@/types/analytics'
import { cn } from '@/lib/utils'

interface AgentAnalyticsPanelProps {
  nodeId: string
  isOpen: boolean
  onClose: () => void
}

// Tab 配置
const TABS = [
  { id: 'overview', label: '概览', icon: BarChart3 },
  { id: 'efficiency', label: '效率', icon: Zap },
  { id: 'tools', label: '工具', icon: Wrench },
  { id: 'quality', label: '质量', icon: Brain },
  { id: 'insights', label: '洞察', icon: Target },
] as const

type TabId = (typeof TABS)[number]['id']

// 指标卡片组件
function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  color = 'blue',
}: {
  label: string
  value: string | number
  subtext?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  color?: 'blue' | 'green' | 'yellow' | 'red'
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4',
        'bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)]',
        'hover:border-[var(--color-border)] transition-colors'
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs',
              trend === 'up' && 'text-green-400',
              trend === 'down' && 'text-red-400',
              trend === 'neutral' && 'text-[var(--color-text-muted)]'
            )}
          >
            <TrendingUp className="w-3 h-3" />
            <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '−'}</span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-[var(--color-text)]">{value}</div>
        <div className="text-xs text-[var(--color-text-muted)] mt-1">{label}</div>
        {subtext && (
          <div className="text-xs text-[var(--color-text-subtle)] mt-1">{subtext}</div>
        )}
      </div>
    </motion.div>
  )
}

// 洞察项组件
function InsightItem({ insight }: { insight: AgentInsight }) {
  const severityIcons = {
    info: CheckCircle,
    warning: AlertTriangle,
    critical: AlertCircle,
  }

  const severityColors = {
    info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  }

  const Icon = severityIcons[insight.severity]

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'p-4 rounded-xl border',
        'bg-[var(--color-bg-elevated)]',
        severityColors[insight.severity]
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{insight.title}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
            {insight.message}
          </div>
          {insight.actionable && insight.action && (
            <button className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)] transition-colors">
              {insight.action.label}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// 概览 Tab
function OverviewTab({ metrics }: { metrics: AgentExecutionMetrics }) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  return (
    <div className="space-y-6">
      {/* 核心指标 */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="总耗时"
          value={formatDuration(metrics.efficiency.totalDuration)}
          icon={Clock}
          color="blue"
        />
        <MetricCard
          label="迭代次数"
          value={`${metrics.efficiency.actualIterations}/${metrics.efficiency.targetIterations}`}
          subtext={`效率: ${metrics.efficiency.efficiency}%`}
          icon={Zap}
          color="green"
        />
        <MetricCard
          label="工具调用"
          value={metrics.toolUsage.totalCalls}
          subtext={`成功率: ${(metrics.toolUsage.successRate * 100).toFixed(1)}%`}
          icon={Wrench}
          color="yellow"
        />
        <MetricCard
          label="综合评分"
          value={metrics.overallScore}
          subtext={metrics.overallScore >= 80 ? '优秀' : metrics.overallScore >= 60 ? '良好' : '需优化'}
          icon={BarChart3}
          color={metrics.overallScore >= 80 ? 'green' : metrics.overallScore >= 60 ? 'yellow' : 'red'}
        />
      </div>

      {/* 时间分布 */}
      <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4 border border-[var(--color-border-subtle)]">
        <div className="text-sm font-medium text-[var(--color-text)] mb-4">时间分布</div>
        <div className="space-y-3">
          {metrics.efficiency.phaseTimings.map((phase) => (
            <div key={phase.phase}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--color-text-muted)] capitalize">
                  {phase.phase === 'thinking' && '思考'}
                  {phase.phase === 'acting' && '行动'}
                  {phase.phase === 'other' && '其他'}
                </span>
                <span className="text-[var(--color-text)]">
                {Number.isFinite(phase.percentage) ? phase.percentage : 0}%
              </span>
              </div>
              <div className="h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${phase.percentage}%` }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className={cn(
                    'h-full rounded-full',
                    phase.phase === 'thinking' && 'bg-blue-500',
                    phase.phase === 'acting' && 'bg-green-500',
                    phase.phase === 'other' && 'bg-gray-500'
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 执行状态 */}
      <div
        className={cn(
          'p-4 rounded-xl border flex items-center gap-3',
          metrics.status === 'completed'
            ? 'bg-green-500/5 border-green-500/20'
            : metrics.status === 'failed'
            ? 'bg-red-500/5 border-red-500/20'
            : 'bg-blue-500/5 border-blue-500/20'
        )}
      >
        <div
          className={cn(
            'w-2 h-2 rounded-full animate-pulse',
            metrics.status === 'completed' && 'bg-green-500',
            metrics.status === 'failed' && 'bg-red-500',
            metrics.status === 'running' && 'bg-blue-500'
          )}
        />
        <span className="text-sm">
          {metrics.status === 'completed' && '执行完成'}
          {metrics.status === 'failed' && '执行失败'}
          {metrics.status === 'running' && '执行中...'}
        </span>
      </div>
    </div>
  )
}

// 效率 Tab
function EfficiencyTab({ metrics }: { metrics: AgentExecutionMetrics }) {
  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4 border border-[var(--color-border-subtle)]">
        <div className="text-sm font-medium text-[var(--color-text)] mb-4">迭代耗时趋势</div>
        <div className="space-y-2">
          {metrics.efficiency.iterationMetrics.map((iter, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-text-muted)] w-12">
                迭代 {iter.iteration}
              </span>
              <div className="flex-1 h-6 bg-[var(--color-bg-input)] rounded-lg overflow-hidden flex">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(iter.thinkingTime / Math.max(...metrics.efficiency.iterationMetrics.map((i) => i.totalTime))) * 100}%` }}
                  className="h-full bg-blue-500/60"
                  title={`思考: ${iter.thinkingTime}ms`}
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(iter.toolTime / Math.max(...metrics.efficiency.iterationMetrics.map((i) => i.totalTime))) * 100}%` }}
                  className="h-full bg-green-500/60"
                  title={`工具: ${iter.toolTime}ms`}
                />
              </div>
              <span className="text-xs text-[var(--color-text-muted)] w-16 text-right">
                {(iter.totalTime / 1000).toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-500/60 rounded" />
            <span className="text-[var(--color-text-muted)]">思考</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-green-500/60 rounded" />
            <span className="text-[var(--color-text-muted)]">工具</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4 border border-[var(--color-border-subtle)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">纯思考时间</div>
          <div className="text-lg font-semibold text-[var(--color-text)]">
            {(metrics.efficiency.pureThinkingTime / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4 border border-[var(--color-border-subtle)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">工具等待时间</div>
          <div className="text-lg font-semibold text-[var(--color-text)]">
            {Number.isFinite(metrics.efficiency.toolWaitTime) ? (metrics.efficiency.toolWaitTime / 1000).toFixed(1) : '0.0'}s
          </div>
        </div>
      </div>
    </div>
  )
}

// 工具 Tab
function ToolsTab({ metrics }: { metrics: AgentExecutionMetrics }) {
  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border-subtle)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border-subtle)]">
          <div className="text-sm font-medium text-[var(--color-text)]">工具使用统计</div>
        </div>
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {metrics.toolUsage.tools.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--color-text-muted)]">
              暂无工具调用数据
            </div>
          ) : (
            metrics.toolUsage.tools.map((tool) => (
              <div key={tool.toolId} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    {tool.toolName}
                  </span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      tool.avgDuration > 3000
                        ? 'bg-yellow-500/10 text-yellow-400'
                        : 'bg-green-500/10 text-green-400'
                    )}
                  >
                    {Number.isFinite(tool.avgDuration) ? (tool.avgDuration / 1000).toFixed(1) : '0.0'}s 平均
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                  <span>调用 {tool.callCount} 次</span>
                  <span className="text-green-400">成功 {tool.successCount}</span>
                  {tool.failCount > 0 && (
                    <span className="text-red-400">失败 {tool.failCount}</span>
                  )}
                </div>
                <div className="mt-2 h-1.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(tool.callCount / Math.max(...metrics.toolUsage.tools.map((t) => t.callCount))) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4 border border-[var(--color-border-subtle)]">
        <div className="text-sm font-medium text-[var(--color-text)] mb-3">并行化统计</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-[var(--color-text-muted)] mb-1">最大并发数</div>
            <div className="text-lg font-semibold text-[var(--color-text)]">
              {metrics.toolUsage.parallelization.maxConcurrent}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--color-text-muted)] mb-1">节省时间</div>
            <div className="text-lg font-semibold text-green-400">
              {(metrics.toolUsage.parallelization.parallelSavings / 1000).toFixed(1)}s
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 质量 Tab
function QualityTab({ metrics }: { metrics: AgentExecutionMetrics }) {
  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4 border border-[var(--color-border-subtle)]">
        <div className="text-sm font-medium text-[var(--color-text)] mb-4">思考质量评分</div>
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-[var(--color-bg-input)]"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <motion.path
                className={cn(
                  metrics.thinkingQuality.qualityScore >= 80
                    ? 'text-green-500'
                    : metrics.thinkingQuality.qualityScore >= 60
                    ? 'text-yellow-500'
                    : 'text-red-500'
                )}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${metrics.thinkingQuality.qualityScore}, 100`}
                initial={{ strokeDasharray: '0, 100' }}
                animate={{ strokeDasharray: `${metrics.thinkingQuality.qualityScore}, 100` }}
                transition={{ duration: 1 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-[var(--color-text)]">
                {metrics.thinkingQuality.qualityScore}
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">平均思考长度</span>
              <span className="text-[var(--color-text)]">
                {metrics.thinkingQuality.avgThoughtLength} 字符
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">冗余思考</span>
              <span className="text-[var(--color-text)]">
                {metrics.thinkingQuality.redundantThoughts.length} 次
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">回溯次数</span>
              <span className="text-[var(--color-text)]">
                {metrics.thinkingQuality.backtracks.length} 次
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 思考长度趋势 */}
      {metrics.thinkingQuality.thoughtLengthTrend.length > 0 && (
        <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4 border border-[var(--color-border-subtle)]">
          <div className="text-sm font-medium text-[var(--color-text)] mb-4">思考长度趋势</div>
          <div className="flex items-end gap-1 h-24">
            {metrics.thinkingQuality.thoughtLengthTrend.map((length, index) => {
              const max = Math.max(...metrics.thinkingQuality.thoughtLengthTrend)
              const height = max > 0 ? (length / max) * 100 : 0
              return (
                <motion.div
                  key={index}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex-1 bg-blue-500/60 rounded-t"
                  title={`迭代 ${index + 1}: ${length} 字符`}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// 洞察 Tab
function InsightsTab({ metrics }: { metrics: AgentExecutionMetrics }) {
  return (
    <div className="space-y-3">
      {metrics.insights.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-12 h-12 bg-[var(--color-bg-input)] rounded-full flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6 text-[var(--color-text-muted)]" />
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">暂无洞察建议</div>
          <div className="text-xs text-[var(--color-text-subtle)] mt-1">
            完成执行后将生成优化建议
          </div>
        </div>
      ) : (
        metrics.insights.map((insight) => <InsightItem key={insight.id} insight={insight} />)
      )}
    </div>
  )
}

// 主面板组件
export function AgentAnalyticsPanel({ nodeId, isOpen, onClose }: AgentAnalyticsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const metrics = useAgentAnalyticsStore((state) => state.getMetrics(nodeId))
  const exportReport = useAgentAnalyticsStore((state) => state.exportReport)

  if (!isOpen) return null

  if (!metrics) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div className="bg-[var(--color-bg)] rounded-2xl p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-[var(--color-bg-input)] rounded-full flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="w-6 h-6 text-[var(--color-text-muted)]" />
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">暂无分析数据</div>
            <div className="text-xs text-[var(--color-text-subtle)] mt-1">
              等待 Agent 执行开始...
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  const handleExport = () => {
    const report = exportReport(nodeId)
    const blob = new Blob([report], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-analytics-${nodeId}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--color-bg)] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--color-text)]">Agent 执行分析</div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {metrics.status === 'running' ? '执行中...' : '执行完成'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
              title="导出报告"
            >
              <Download className="w-4 h-4 text-[var(--color-text-muted)]" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--color-text-muted)]" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-[var(--color-border-subtle)] overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'overview' && <OverviewTab metrics={metrics} />}
              {activeTab === 'efficiency' && <EfficiencyTab metrics={metrics} />}
              {activeTab === 'tools' && <ToolsTab metrics={metrics} />}
              {activeTab === 'quality' && <QualityTab metrics={metrics} />}
              {activeTab === 'insights' && <InsightsTab metrics={metrics} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default AgentAnalyticsPanel
