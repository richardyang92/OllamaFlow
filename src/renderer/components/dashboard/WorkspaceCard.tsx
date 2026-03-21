import { motion } from 'framer-motion'
import { Folder, Trash2, ExternalLink, Clock, CheckCircle, XCircle, Loader2, Play, Sparkles } from 'lucide-react'
import type { RecentWorkspace } from '@/types/workspace'
import { cn } from '@/lib/utils'

interface ExecutionStatus {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  totalNodes: number
  completedNodes: number
  currentNode?: string
  error?: string
  startTime?: string
  endTime?: string
}

interface WorkspaceCardProps {
  workspace: RecentWorkspace
  executionStatus?: ExecutionStatus | null
  onOpen: (path: string) => void
  onRemove: (path: string) => void
  isLoading?: boolean
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-CN')
}

export function WorkspaceCard({
  workspace,
  executionStatus,
  onOpen,
  onRemove,
  isLoading = false,
}: WorkspaceCardProps) {
  const handleOpen = () => {
    if (!isLoading) {
      onOpen(workspace.path)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove(workspace.path)
  }

  const handleShowInFinder = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await window.electronAPI.command.execute(workspace.path, { command: `open "${workspace.path}"` })
  }

  const truncatedPath = workspace.path.length > 50
    ? '...' + workspace.path.slice(-47)
    : workspace.path

  const getStatusColor = () => {
    if (!executionStatus) return 'text-[var(--color-text-muted)]'
    switch (executionStatus.status) {
      case 'running': return 'text-green-400'
      case 'completed': return 'text-green-500'
      case 'failed': return 'text-red-400'
      case 'cancelled': return 'text-[var(--color-text-muted)]'
      default: return 'text-[var(--color-text-muted)]'
    }
  }

  const getStatusIcon = () => {
    if (!executionStatus) return <Play className="w-4 h-4" />
    switch (executionStatus.status) {
      case 'running': return <Loader2 className="w-4 h-4 animate-spin" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'failed': return <XCircle className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getStatusText = () => {
    if (!executionStatus) return '打开项目'
    switch (executionStatus.status) {
      case 'running': return `执行中 ${executionStatus.progress}%`
      case 'completed': return executionStatus.endTime ? `${formatRelativeTime(executionStatus.endTime)} 完成` : '已完成'
      case 'failed': return '执行失败'
      case 'cancelled': return '已取消'
      default: return '打开项目'
    }
  }

  const isRunning = executionStatus?.status === 'running'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.01, y: -4 }}
      whileTap={{ scale: 0.99 }}
      onClick={handleOpen}
      className={cn(
        'relative rounded-2xl cursor-pointer overflow-hidden',
        'glass-panel',
        'transition-all duration-300',
        'group',
        isLoading && 'opacity-50 pointer-events-none',
        isRunning && 'ring-2 ring-green-500/30'
      )}
    >
      {/* Subtle top accent line - macOS style */}
      <div className={cn(
        'h-0.5 w-full',
        'bg-gradient-to-r from-transparent via-[var(--color-border-subtle)] to-transparent',
        'opacity-50 group-hover:opacity-100 transition-opacity duration-300',
        isRunning && 'opacity-100'
      )} />

      {/* Subtle inner highlight on hover */}
      <div className={cn(
        'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none',
        'bg-gradient-to-br from-[var(--color-accent)]/3 via-transparent to-transparent'
      )} />

      <div className="p-5 relative">
        {/* Main content area */}
        <div className="flex gap-4">
          {/* Left icon with liquid glass effect */}
          <div className={cn(
            'relative w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0',
            'bg-[var(--color-bg-input)]',
            'group-hover:bg-[var(--color-bg-hover)]',
            'transition-all duration-300',
            'border border-[var(--color-border-subtle)]'
          )}>
            {/* Inner highlight */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Folder className="w-7 h-7 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors duration-300 relative z-10" />

            {/* Running indicator */}
            {isRunning && (
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h3 className="text-base font-semibold text-[var(--color-text)] truncate leading-tight">
                {workspace.name}
              </h3>

              {/* Action buttons - macOS style */}
              <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleShowInFinder}
                  className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center',
                    'text-[var(--color-text-muted)]',
                    'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
                    'transition-all duration-150'
                  )}
                  title="在 Finder 中显示"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleRemove}
                  className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center',
                    'text-[var(--color-text-muted)]',
                    'hover:bg-red-500/10 hover:text-red-400',
                    'transition-all duration-150'
                  )}
                  title="删除工作区"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </div>

            {/* Description */}
            {workspace.description && (
              <p className="text-xs text-[var(--color-text-muted)] mb-2 line-clamp-1 leading-relaxed">
                {workspace.description}
              </p>
            )}

            {/* Path */}
            <p className="text-[11px] text-[var(--color-text-subtle)] truncate mb-3 font-mono" title={workspace.path}>
              {truncatedPath}
            </p>

            {/* Bottom status bar - cleaner design */}
            <div className="flex items-center justify-between gap-2">
              <div className={cn('flex items-center gap-1.5 min-w-0 flex-1', getStatusColor())}>
                {getStatusIcon()}
                <span className="text-xs font-medium truncate">{getStatusText()}</span>
                {isRunning && executionStatus.currentNode && (
                  <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[80px] flex-shrink-0">
                    · {executionStatus.currentNode}
                  </span>
                )}
              </div>

              {/* Open badge - macOS pill style */}
              <div className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0',
                'bg-[var(--color-bg-hover)]',
                'text-[var(--color-text-muted)]',
                'group-hover:bg-[var(--color-accent-bg)] group-hover:text-[var(--color-accent)]',
                'transition-all duration-200'
              )}>
                <Sparkles className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity duration-200" />
                <span>打开</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar container - always takes space to maintain consistent card height */}
        <div className="mt-3 h-1 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
          {isRunning ? (
            <motion.div
              className="h-full bg-[var(--color-accent)]"
              initial={{ width: 0 }}
              animate={{ width: `${executionStatus?.progress || 0}%` }}
              transition={{ duration: 0.3 }}
            />
          ) : (
            <div className="h-full w-0" />
          )}
        </div>
      </div>
    </motion.div>
  )
}
