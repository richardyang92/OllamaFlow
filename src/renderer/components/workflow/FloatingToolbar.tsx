import { motion } from 'framer-motion'
import { Play, Square, Save, ArrowLeft, FileText, Sun, Moon, Monitor, Blocks } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext'
import type { ExecutionStatus } from '@/types/execution'
import { cn } from '@/lib/utils'

interface FloatingToolbarProps {
  workspaceName: string
  isDirty: boolean
  executionStatus: ExecutionStatus
  showPalette: boolean
  showLogs: boolean
  saveActive: boolean
  onSave: () => void
  onClose: () => void
  onExecute: () => void
  onToggleLogs: () => void
  onTogglePalette: () => void
}

function StatusIndicator({
  isDirty,
  executionStatus,
}: {
  isDirty: boolean
  executionStatus: ExecutionStatus
}) {
  const getStatusStyle = () => {
    switch (executionStatus) {
      case 'running':
        return {
          className: 'bg-yellow-400',
          animate: { opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] },
          repeat: Infinity,
        }
      case 'completed':
        return {
          className: 'bg-green-400',
          animate: { opacity: 1, scale: 1 },
          repeat: 0,
        }
      case 'failed':
      case 'cancelled':
        return {
          className: 'bg-red-400',
          animate: { opacity: 1, scale: 1 },
          repeat: 0,
        }
      case 'idle':
      default:
        if (isDirty) {
          return {
            className: 'bg-yellow-400',
            animate: { opacity: [0.5, 1, 0.5] },
            repeat: Infinity,
          }
        }
        return {
          className: 'bg-gray-400',
          animate: { opacity: 1, scale: 1 },
          repeat: 0,
        }
    }
  }

  const { className, animate, repeat } = getStatusStyle()

  return (
    <motion.span
      animate={animate}
      transition={{ duration: 2, repeat }}
      className={cn('w-2 h-2 rounded-full', className)}
    />
  )
}

export function FloatingToolbar({
  workspaceName,
  isDirty,
  executionStatus,
  showPalette,
  showLogs,
  saveActive,
  onSave,
  onClose,
  onExecute,
  onToggleLogs,
  onTogglePalette,
}: FloatingToolbarProps) {
  const { themeMode, setThemeMode, resolvedTheme } = useTheme()

  const handleThemeToggle = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(themeMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setThemeMode(nextMode)
  }

  const ThemeIcon = themeMode === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      transition={{ duration: 0.3 }}
      className={cn(
        'fixed top-4 left-1/2 z-50',
        'flex items-center gap-1',
        'px-2 py-1.5',
        'glass-floating',
        'rounded-full'
      )}
    >
      {/* Close button */}
      <ToolbarButton
        icon={ArrowLeft}
        onClick={onClose}
        tooltip="关闭工作区"
      />

      {/* Divider */}
      <div className="w-px h-5 bg-[var(--color-border)] mx-1" />

      {/* Workspace name */}
      <div className="flex items-center gap-2 px-2">
        <span className="text-sm font-medium text-[var(--color-text)] max-w-32 truncate">
          {workspaceName}
        </span>
        <StatusIndicator isDirty={isDirty} executionStatus={executionStatus} />
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-[var(--color-border)] mx-1" />

      {/* Action buttons */}
      <ToolbarButton
        icon={Blocks}
        onClick={onTogglePalette}
        tooltip="节点面板"
        active={showPalette}
      />
      <ToolbarButton
        icon={FileText}
        onClick={onToggleLogs}
        tooltip="执行日志"
        active={showLogs}
      />
      <ToolbarButton
        icon={Save}
        onClick={onSave}
        disabled={!isDirty && !saveActive}
        tooltip="保存 (⌘S)"
        active={saveActive}
      />
      <ToolbarButton
        icon={executionStatus === 'running' ? Square : Play}
        onClick={onExecute}
        tooltip={executionStatus === 'running' ? '停止' : '执行 (⌘Enter)'}
        primary
        active={executionStatus === 'running'}
      />

      {/* Divider */}
      <div className="w-px h-5 bg-[var(--color-border)] mx-1" />

      {/* Theme toggle */}
      <ToolbarButton
        icon={ThemeIcon}
        onClick={handleThemeToggle}
        tooltip={`主题: ${themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色'}`}
      />
    </motion.div>
  )
}

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
  disabled?: boolean
  tooltip?: string
  primary?: boolean
  highlight?: boolean
  active?: boolean
}

function ToolbarButton({
  icon: Icon,
  onClick,
  disabled = false,
  tooltip,
  primary = false,
  highlight = false,
  active = false,
}: ToolbarButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={cn(
        'relative flex items-center justify-center',
        'w-8 h-8 rounded-full',
        'transition-all duration-200',
        disabled && 'opacity-40 cursor-not-allowed',
        primary && !active && [
          'bg-gradient-to-r from-blue-500/80 to-purple-500/80',
          'text-white',
          'shadow-lg shadow-blue-500/25',
          'hover:shadow-xl hover:shadow-blue-500/30',
        ],
        active && [
          'bg-red-500/80',
          'text-white',
          'shadow-lg shadow-red-500/25',
        ],
        !primary && !active && [
          'text-[var(--color-text-muted)]',
          'hover:text-[var(--color-text)]',
          'hover:bg-[var(--color-bg-input)]',
        ],
        highlight && !primary && [
          'ring-2 ring-yellow-400/50',
          'ring-offset-2 ring-offset-transparent',
        ]
      )}
    >
      <Icon className="w-4 h-4" />
    </motion.button>
  )
}
