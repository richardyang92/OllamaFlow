import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Square, Save, ArrowLeft, Sun, Moon, Monitor, Undo2, Redo2, Download, Upload, Pencil } from 'lucide-react'
import { WorkspaceEditDialog } from './WorkspaceEditDialog'
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext'
import { useTemporalStore } from '@/store/workflow-store'
import type { ExecutionStatus } from '@/types/execution'
import { cn } from '@/lib/utils'

interface FloatingToolbarProps {
  workspaceName: string
  workspaceDescription?: string
  isDirty: boolean
  executionStatus: ExecutionStatus
  saveActive: boolean
  onSave: () => void
  onClose: () => void
  onExecute: () => void
  onExport?: () => void
  onImport?: () => void
  onEditInfo?: (name: string, description: string) => void
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
  workspaceDescription,
  isDirty,
  executionStatus,
  saveActive,
  onSave,
  onClose,
  onExecute,
  onExport,
  onImport,
  onEditInfo,
}: FloatingToolbarProps) {
  const { themeMode, setThemeMode, resolvedTheme } = useTheme()
  const [isHovered, setIsHovered] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)

  // Undo/Redo state
  const { undo, redo, pastStates, futureStates } = useTemporalStore((state) => ({
    undo: state.undo,
    redo: state.redo,
    pastStates: state.pastStates,
    futureStates: state.futureStates,
  }))

  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  const handleThemeToggle = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(themeMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setThemeMode(nextMode)
  }

  const ThemeIcon = themeMode === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun
  const isDark = resolvedTheme === 'dark'
  const glowColor = isDark ? '255,255,255' : '0,0,0'
  const shadowValue = isHovered
    ? `0 0 30px rgba(${glowColor},0.1), 0 0 60px rgba(${glowColor},0.05)`
    : `0 0 20px rgba(${glowColor},0.05)`

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      transition={{ duration: 0.3 }}
      style={{
        boxShadow: shadowValue,
      }}
      className={cn(
        'fixed top-4 left-1/2 z-50',
        'flex items-center gap-1',
        'px-2 py-1.5',
        'rounded-full',
        isHovered ? 'bg-[var(--color-bg-elevated)]/80 backdrop-blur-xl' : 'bg-[var(--color-bg-elevated)]/5 backdrop-blur-sm',
        'transition-all duration-300'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ToolbarButton
        icon={ArrowLeft}
        onClick={onClose}
        tooltip="关闭工作区"
        isHovered={isHovered}
      />

      <div className={cn(
        'w-px h-5 mx-1 transition-colors duration-300',
        isHovered ? 'bg-[var(--color-border)]' : 'bg-[var(--color-border)]/30'
      )} />

      <div className="flex items-center gap-2 px-2">
        <span
          className="text-sm font-medium max-w-32 truncate transition-opacity duration-300"
          style={{
            color: 'var(--color-text)',
            opacity: isHovered ? 1 : 0.5
          }}
        >
          {workspaceName}
        </span>
        <StatusIndicator isDirty={isDirty} executionStatus={executionStatus} />
        {onEditInfo && (
          <ToolbarButton
            icon={Pencil}
            onClick={() => setShowEditDialog(true)}
            tooltip="编辑工作流信息"
            isHovered={isHovered}
          />
        )}
      </div>

      <div className={cn(
        'w-px h-5 mx-1 transition-colors duration-300',
        isHovered ? 'bg-[var(--color-border)]' : 'bg-[var(--color-border)]/30'
      )} />

      {/* Undo/Redo buttons */}
      <ToolbarButton
        icon={Undo2}
        onClick={() => undo()}
        disabled={!canUndo}
        tooltip="撤销 (⌘Z)"
        isHovered={isHovered}
      />
      <ToolbarButton
        icon={Redo2}
        onClick={() => redo()}
        disabled={!canRedo}
        tooltip="重做 (⌘⇧Z)"
        isHovered={isHovered}
      />

      <div className={cn(
        'w-px h-5 mx-1 transition-colors duration-300',
        isHovered ? 'bg-[var(--color-border)]' : 'bg-[var(--color-border)]/30'
      )} />

      {/* Import/Export buttons */}
      {onImport && (
        <ToolbarButton
          icon={Upload}
          onClick={onImport}
          tooltip="导入工作流"
          isHovered={isHovered}
        />
      )}
      {onExport && (
        <ToolbarButton
          icon={Download}
          onClick={onExport}
          tooltip="导出工作流"
          isHovered={isHovered}
        />
      )}

      <div className={cn(
        'w-px h-5 mx-1 transition-colors duration-300',
        isHovered ? 'bg-[var(--color-border)]' : 'bg-[var(--color-border)]/30'
      )} />

      <ToolbarButton
        icon={Save}
        onClick={onSave}
        disabled={!isDirty && !saveActive}
        tooltip="保存 (⌘S)"
        active={saveActive}
        isHovered={isHovered}
      />
      <ToolbarButton
        icon={executionStatus === 'running' ? Square : Play}
        onClick={onExecute}
        tooltip={executionStatus === 'running' ? '停止' : '执行 (⌘Enter)'}
        primary
        active={executionStatus === 'running'}
        isHovered={isHovered}
      />

      <div className={cn(
        'w-px h-5 mx-1 transition-colors duration-300',
        isHovered ? 'bg-[var(--color-border)]' : 'bg-[var(--color-border)]/30'
      )} />

      <ToolbarButton
        icon={ThemeIcon}
        onClick={handleThemeToggle}
        tooltip={`主题: ${themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色'}`}
        isHovered={isHovered}
      />

      {/* Edit Dialog */}
      {showEditDialog && onEditInfo && (
        <WorkspaceEditDialog
          name={workspaceName}
          description={workspaceDescription || ''}
          onSubmit={(name, description) => {
            onEditInfo(name, description)
            setShowEditDialog(false)
          }}
          onCancel={() => setShowEditDialog(false)}
        />
      )}
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
  isHovered?: boolean
}

function ToolbarButton({
  icon: Icon,
  onClick,
  disabled = false,
  tooltip,
  primary = false,
  highlight = false,
  active = false,
  isHovered = false,
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
        'transition-all duration-300',
        isHovered ? 'opacity-100' : 'opacity-50',
        disabled && 'opacity-30! cursor-not-allowed',
        primary && !active && [
          'bg-gradient-to-r from-blue-500/60 to-purple-500/60',
          'text-white',
          isHovered && 'from-blue-500/80 to-purple-500/80 shadow-lg shadow-blue-500/25',
        ],
        active && [
          'bg-red-500/60',
          'text-white',
          isHovered && 'bg-red-500/80 shadow-lg shadow-red-500/25',
        ],
        !primary && !active && [
          'text-[var(--color-text-muted)]',
          'hover:text-[var(--color-text)]',
          'hover:bg-[var(--color-bg-input)]/50',
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
