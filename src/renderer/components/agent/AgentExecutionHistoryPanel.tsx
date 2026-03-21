/**
 * 独立 Agent 执行分析页面
 * 显示所有 Agent 执行历史记录，支持查看详细分析
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Clock,
  Search,
  Filter,
  ChevronLeft,
  Calendar,
  CheckCircle,
  XCircle,
  Trash2,
  ArrowLeft,
  Zap,
  Wrench,
  Brain,
  Target,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import { useAgentAnalyticsStore } from '@/store/agent-analytics-store'
import type {
  AgentExecutionMetrics,
  HistoricalComparison,
} from '@/types/analytics'
import { cn } from '@/lib/utils'

// 执行记录列表项
interface ExecutionListItemProps {
  record: HistoricalComparison
  isSelected: boolean
  onClick: () => void
}

function ExecutionListItem({ record, isSelected, onClick }: ExecutionListItemProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'w-full p-4 text-left border-b border-[var(--color-border-subtle)] transition-colors',
        isSelected
          ? 'bg-blue-500/10 border-l-4 border-l-blue-500'
          : 'hover:bg-[var(--color-bg-hover)] border-l-4 border-l-transparent'
      )}
      whileHover={{ x: isSelected ? 0 : 2 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--color-text)] truncate mb-1">
            {record.query}
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(record.timestamp)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(record.duration)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {record.success ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              record.overallScore >= 80
                ? 'text-green-400'
                : record.overallScore >= 60
                ? 'text-yellow-400'
                : 'text-red-400'
            )}
          >
            {record.overallScore}分
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
        <span>{record.iterationCount} 次迭代</span>
        <span>{record.toolCallCount} 次工具调用</span>
      </div>
    </motion.button>
  )
}

// 统计卡片
function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  color = 'blue',
}: {
  label: string
  value: string
  subtext?: string
  icon: React.ElementType
  color?: 'blue' | 'green' | 'yellow' | 'red'
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    red: 'bg-red-500/10 text-red-400',
  }

  return (
    <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4 border border-[var(--color-border-subtle)]">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', colorClasses[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xl font-bold text-[var(--color-text)]">{value}</div>
      <div className="text-xs text-[var(--color-text-muted)] mt-1">{label}</div>
      {subtext && <div className="text-xs text-[var(--color-text-subtle)] mt-1">{subtext}</div>}
    </div>
  )
}

// 详细分析视图
function ExecutionDetailView({
  metrics,
  onBack,
}: {
  metrics: AgentExecutionMetrics
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'efficiency' | 'tools' | 'quality' | 'insights'>('overview')

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  const TabButton = ({
    id,
    label,
    icon: Icon,
  }: {
    id: typeof activeTab
    label: string
    icon: React.ElementType
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors',
        activeTab === id
          ? 'bg-blue-500/10 text-blue-400'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )

  return (
    <div className="h-full flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-[var(--color-border-subtle)] flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
        </button>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-sm font-medium text-[var(--color-text)] truncate" title={metrics.query}>{metrics.query}</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {new Date(metrics.timestamp).toLocaleString('zh-CN')}
          </div>
        </div>
        <div
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium flex-shrink-0',
            metrics.status === 'completed'
              ? 'bg-green-500/10 text-green-400'
              : metrics.status === 'failed'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-blue-500/10 text-blue-400'
          )}
        >
          {metrics.status === 'completed' && '完成'}
          {metrics.status === 'failed' && '失败'}
          {metrics.status === 'running' && '执行中'}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-4 border-b border-[var(--color-border-subtle)] overflow-x-auto flex-shrink-0">
        <TabButton id="overview" label="概览" icon={BarChart3} />
        <TabButton id="efficiency" label="效率" icon={Zap} />
        <TabButton id="tools" label="工具" icon={Wrench} />
        <TabButton id="quality" label="质量" icon={Brain} />
        <TabButton id="insights" label="洞察" icon={Target} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="总耗时"
                    value={formatDuration(metrics.efficiency.totalDuration)}
                    icon={Clock}
                    color="blue"
                  />
                  <StatCard
                    label="迭代次数"
                    value={`${metrics.efficiency.actualIterations}/${metrics.efficiency.targetIterations}`}
                    subtext={`效率: ${metrics.efficiency.efficiency}%`}
                    icon={Zap}
                    color="green"
                  />
                  <StatCard
                    label="工具调用"
                    value={String(metrics.toolUsage.totalCalls)}
                    subtext={`成功率: ${(metrics.toolUsage.successRate * 100).toFixed(1)}%`}
                    icon={Wrench}
                    color="yellow"
                  />
                  <StatCard
                    label="综合评分"
                    value={String(metrics.overallScore)}
                    subtext={
                      metrics.overallScore >= 80
                        ? '优秀'
                        : metrics.overallScore >= 60
                        ? '良好'
                        : '需优化'
                    }
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
                          <span className="text-[var(--color-text-muted)]">
                            {phase.phase === 'thinking' && '思考'}
                            {phase.phase === 'acting' && '行动'}
                            {phase.phase === 'other' && '其他'}
                          </span>
                          <span className="text-[var(--color-text)]">
                            {Number.isFinite(phase.percentage) ? phase.percentage : 0}%
                          </span>
                        </div>
                        <div className="h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              phase.phase === 'thinking' && 'bg-blue-500',
                              phase.phase === 'acting' && 'bg-green-500',
                              phase.phase === 'other' && 'bg-gray-500'
                            )}
                            style={{ width: `${phase.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'efficiency' && (
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
                          <div
                            className="h-full bg-blue-500/60"
                            style={{
                              width: `${
                                (iter.thinkingTime /
                                  Math.max(...metrics.efficiency.iterationMetrics.map((i) => i.totalTime))) *
                                100
                              }%`,
                            }}
                          />
                          <div
                            className="h-full bg-green-500/60"
                            style={{
                              width: `${
                                (iter.toolTime /
                                  Math.max(...metrics.efficiency.iterationMetrics.map((i) => i.totalTime))) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-[var(--color-text-muted)] w-16 text-right">
                          {(iter.totalTime / 1000).toFixed(1)}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
            )}

            {activeTab === 'tools' && (
              <div className="space-y-4">
                <div className="bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border-subtle)] overflow-hidden">
                  <div className="p-4 border-b border-[var(--color-border-subtle)]">
                    <div className="text-sm font-medium text-[var(--color-text)]">工具使用统计</div>
                  </div>
                  <div className="divide-y divide-[var(--color-border-subtle)]">
                    {metrics.toolUsage.tools.map((tool) => (
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
                          {tool.failCount > 0 && <span className="text-red-400">失败 {tool.failCount}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'quality' && (
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
                        <path
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
              </div>
            )}

            {activeTab === 'insights' && (
              <div className="space-y-3">
                {metrics.insights.length === 0 ? (
                  <div className="p-8 text-center">
                    <Target className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
                    <div className="text-sm text-[var(--color-text-muted)]">暂无洞察建议</div>
                  </div>
                ) : (
                  metrics.insights.map((insight) => (
                    <div
                      key={insight.id}
                      className={cn(
                        'p-4 rounded-xl border',
                        insight.severity === 'info' && 'bg-blue-500/5 border-blue-500/20 text-blue-400',
                        insight.severity === 'warning' &&
                          'bg-yellow-500/5 border-yellow-500/20 text-yellow-400',
                        insight.severity === 'critical' && 'bg-red-500/5 border-red-500/20 text-red-400'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {insight.severity === 'info' && <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                        {insight.severity === 'warning' && (
                          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        )}
                        {insight.severity === 'critical' && (
                          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{insight.title}</div>
                          <div className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                            {insight.message}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// 主组件
interface AgentExecutionHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function AgentExecutionHistoryPanel({ isOpen, onClose }: AgentExecutionHistoryPanelProps) {
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all')

  const { history, clearHistory, getMetricsByExecutionId } = useAgentAnalyticsStore()

  // 过滤记录
  const filteredExecutions = useMemo(() => {
    return history.filter((record) => {
      // 搜索过滤
      if (searchQuery && !record.query.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // 状态过滤
      if (filterStatus === 'success' && !record.success) return false
      if (filterStatus === 'failed' && record.success) return false

      return true
    })
  }, [history, searchQuery, filterStatus])

  // 获取选中的执行详情
  const selectedMetrics = useMemo(() => {
    if (!selectedExecutionId) return null
    return getMetricsByExecutionId(selectedExecutionId)
  }, [selectedExecutionId, getMetricsByExecutionId])

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--color-bg)] rounded-2xl w-full max-w-6xl h-[80vh] flex overflow-hidden shadow-2xl"
        style={{ width: '90vw', maxWidth: '1200px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧：执行记录列表 */}
        <div className="w-80 flex flex-col border-r border-[var(--color-border-subtle)] flex-shrink-0">
          {/* Header */}
          <div className="p-4 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-[var(--color-text)]">执行记录</h2>
              </div>
              <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-hover)]">
                <ChevronLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
              </button>
            </div>

            {/* 搜索和过滤 */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="搜索执行记录..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                  className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg px-2 py-1.5 text-sm text-[var(--color-text)] focus:outline-none"
                >
                  <option value="all">全部</option>
                  <option value="success">成功</option>
                  <option value="failed">失败</option>
                </select>
                {filteredExecutions.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                    title="清空历史"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 记录列表 */}
          <div className="flex-1 overflow-y-auto">
            {filteredExecutions.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-[var(--color-bg-input)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-[var(--color-text-muted)]" />
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  {searchQuery || filterStatus !== 'all' ? '没有找到匹配的记录' : '暂无执行记录'}
                </div>
                <div className="text-xs text-[var(--color-text-subtle)] mt-1">
                  {searchQuery || filterStatus !== 'all'
                    ? '尝试调整搜索条件'
                    : '执行 Agent 任务后将显示在这里'}
                </div>
              </div>
            ) : (
              filteredExecutions.map((record) => (
                <ExecutionListItem
                  key={record.executionId}
                  record={record}
                  isSelected={selectedExecutionId === record.executionId}
                  onClick={() => setSelectedExecutionId(record.executionId)}
                />
              ))
            )}
          </div>

          {/* 底部统计 */}
          <div className="p-4 border-t border-[var(--color-border-subtle)] text-xs text-[var(--color-text-muted)]">
            共 {filteredExecutions.length} 条记录
          </div>
        </div>

        {/* 右侧：详情视图 */}
        <div className="flex-1 bg-[var(--color-bg-elevated)] min-w-0 overflow-hidden">
          {selectedMetrics ? (
            <ExecutionDetailView metrics={selectedMetrics} onBack={() => setSelectedExecutionId(null)} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-[var(--color-bg-input)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-10 h-10 text-[var(--color-text-muted)]" />
                </div>
                <div className="text-lg font-medium text-[var(--color-text)] mb-2">选择执行记录</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  从左侧列表选择一条记录查看详细分析
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default AgentExecutionHistoryPanel
