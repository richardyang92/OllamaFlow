import { motion } from 'framer-motion'
import { Folder, Trash2, ExternalLink, Clock, CheckCircle, XCircle, Loader2, Play } from 'lucide-react'
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
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={handleOpen}
      className={cn(
        'relative rounded-2xl cursor-pointer overflow-hidden',
        'glass-panel',
        'hover:shadow-xl hover:shadow-purple-500/10',
        'transition-all duration-300',
        'group',
        isLoading && 'opacity-50 pointer-events-none',
        isRunning && 'ring-2 ring-green-500/30'
      )}
    >
      {/* 顶部装饰条 */}
      <div className={cn(
        'h-1.5 w-full',
        'bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500',
        'opacity-60 group-hover:opacity-100 transition-opacity duration-300',
        isRunning && 'opacity-100'
      )} />

      <div className="p-6">
        {/* 主体内容区域 */}
        <div className="flex gap-5">
          {/* 左侧大图标 */}
          <div className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0',
            'bg-gradient-to-br from-purple-500/20 to-blue-500/20',
            'group-hover:from-purple-500/30 group-hover:to-blue-500/30',
            'transition-all duration-300',
            'shadow-lg shadow-purple-500/10'
          )}>
            <Folder className="w-8 h-8 text-purple-400" />
          </div>

          {/* 右侧信息 */}
          <div className="flex-1 min-w-0">
            {/* 标题行 */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-lg font-semibold text-[var(--color-text)] truncate">
                {workspace.name}
              </h3>

              {/* 操作按钮 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleShowInFinder}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
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
                    'w-8 h-8 rounded-lg flex items-center justify-center',
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

            {/* 描述 */}
            {workspace.description && (
              <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">
                {workspace.description}
              </p>
            )}

            {/* 路径 */}
            <p className="text-xs text-[var(--color-text-muted)] truncate mb-4 font-mono" title={workspace.path}>
              {truncatedPath}
            </p>

            {/* 底部状态栏 */}
            <div className="flex items-center justify-between">
              <div className={cn('flex items-center gap-2', getStatusColor())}>
                {getStatusIcon()}
                <span className="text-sm font-medium">{getStatusText()}</span>
                {isRunning && executionStatus.currentNode && (
                  <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[120px]">
                    · {executionStatus.currentNode}
                  </span>
                )}
              </div>

              <div className={cn(
                'px-3 py-1 rounded-full text-xs font-medium',
                'bg-[var(--color-bg-hover)]',
                'text-[var(--color-text-muted)]',
                'group-hover:bg-purple-500/10 group-hover:text-purple-400',
                'transition-all duration-200'
              )}>
                打开
              </div>
            </div>
          </div>
        </div>

        {/* 运行进度条 */}
        {isRunning && (
          <div className="mt-4 h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${executionStatus?.progress || 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}
