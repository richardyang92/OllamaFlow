import { motion } from 'framer-motion'
import { Folder, Trash2, ExternalLink, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
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

  const truncatedPath = workspace.path.length > 40
    ? '...' + workspace.path.slice(-37)
    : workspace.path

  const renderStatus = () => {
    if (!executionStatus) {
      return (
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Clock className="w-4 h-4" />
          <span className="text-sm">点击打开</span>
        </div>
      )
    }

    switch (executionStatus.status) {
      case 'running':
        return (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
            <span className="text-sm text-green-400">
              执行中 {executionStatus.progress}%
            </span>
            {executionStatus.currentNode && (
              <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[100px]">
                {executionStatus.currentNode}
              </span>
            )}
          </div>
        )
      case 'completed':
        return (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-[var(--color-text-muted)]">
              {executionStatus.endTime && formatRelativeTime(executionStatus.endTime)} 完成
            </span>
          </div>
        )
      case 'failed':
        return (
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">
              执行失败
            </span>
          </div>
        )
      case 'cancelled':
        return (
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <XCircle className="w-4 h-4" />
            <span className="text-sm">已取消</span>
          </div>
        )
      default:
        return (
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <Clock className="w-4 h-4" />
            <span className="text-sm">点击打开</span>
          </div>
        )
    }
  }

  const isRunning = executionStatus?.status === 'running'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleOpen}
      className={cn(
        'relative p-5 rounded-xl cursor-pointer',
        'glass-panel',
        'hover:shadow-lg hover:shadow-purple-500/10',
        'transition-all duration-200',
        'group',
        isLoading && 'opacity-50 pointer-events-none',
        isRunning && 'ring-2 ring-green-500/30'
      )}
    >
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            'bg-gradient-to-br from-purple-500/20 to-blue-500/20',
            'group-hover:from-purple-500/30 group-hover:to-blue-500/30',
            'transition-all duration-200'
          )}>
            <Folder className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[var(--color-text)] truncate">
              {workspace.name}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] truncate" title={workspace.path}>
              {truncatedPath}
            </p>
            {workspace.description && (
              <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5" title={workspace.description}>
                {workspace.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleShowInFinder}
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center',
              'text-[var(--color-text-muted)]',
              'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
              'transition-all duration-200',
              'opacity-0 group-hover:opacity-100'
            )}
            title="在 Finder 中显示"
          >
            <ExternalLink className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleRemove}
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center',
              'text-[var(--color-text-muted)]',
              'hover:bg-red-500/10 hover:text-red-400',
              'transition-all duration-200',
              'opacity-0 group-hover:opacity-100'
            )}
            title="删除工作区"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {renderStatus()}
      </div>

      {isRunning && (
        <div className="mt-3 h-1 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${executionStatus?.progress || 0}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}
    </motion.div>
  )
}
