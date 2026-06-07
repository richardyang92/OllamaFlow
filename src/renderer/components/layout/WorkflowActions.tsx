import { motion } from 'framer-motion'
import {
  Play,
  Square,
  Save,
  Undo2,
  Redo2,
  Download,
  Upload,
} from 'lucide-react'
import { useTemporalStore } from '@/store/workflow-store'
import { cn } from '@/lib/utils'
import type { ExecutionStatus } from '@/types/execution'
import { WorkspaceInfo } from './WorkspaceInfo'

interface WorkflowActionsProps {
  workspaceName: string
  workspaceDescription?: string
  isDirty: boolean
  executionStatus: ExecutionStatus
  saveActive: boolean
  onSave: () => void
  onExecute: () => void
  onExport?: () => void
  onImport?: () => void
  onEditInfo?: (name: string, description: string) => void
}

function ActionButton({
  icon: Icon,
  onClick,
  disabled = false,
  tooltip,
  variant = 'default',
  active = false,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
  disabled?: boolean
  tooltip?: string
  variant?: 'default' | 'primary' | 'danger'
  active?: boolean
  className?: string
}) {
  const baseStyles = cn(
    'w-8 h-8 rounded-lg flex items-center justify-center',
    'transition-all duration-200',
    disabled && 'opacity-30 cursor-not-allowed'
  )

  const variantStyles = {
    default: cn(
      'text-[var(--color-text-muted)]',
      active
        ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
        : 'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
    ),
    primary: cn(
      'bg-[var(--color-accent)] text-white',
      'hover:bg-[var(--color-accent-hover)]'
    ),
    danger: cn(
      'bg-red-500/80 text-white',
      'hover:bg-red-500'
    ),
  }

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={cn(baseStyles, variantStyles[variant], className)}
    >
      <Icon className="w-4 h-4" />
    </motion.button>
  )
}

export function WorkflowActions({
  workspaceName,
  workspaceDescription,
  isDirty,
  executionStatus,
  saveActive,
  onSave,
  onExecute,
  onExport,
  onImport,
  onEditInfo,
}: WorkflowActionsProps) {
  // Undo/Redo state
  const { undo, redo, pastStates, futureStates } = useTemporalStore((state) => ({
    undo: state.undo,
    redo: state.redo,
    pastStates: state.pastStates,
    futureStates: state.futureStates,
  }))

  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0
  const isRunning = executionStatus === 'running'

  return (
    <div className="flex items-center gap-1">
      {/* Workspace info */}
      <WorkspaceInfo
        name={workspaceName}
        description={workspaceDescription}
        isDirty={isDirty}
        executionStatus={executionStatus}
        onEditInfo={onEditInfo}
      />

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--color-border-subtle)] mx-1" />

      {/* Undo/Redo */}
      <ActionButton
        icon={Undo2}
        onClick={() => undo()}
        disabled={!canUndo}
        tooltip="撤销 (⌘Z)"
      />
      <ActionButton
        icon={Redo2}
        onClick={() => redo()}
        disabled={!canRedo}
        tooltip="重做 (⌘⇧Z)"
      />

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--color-border-subtle)] mx-1" />

      {/* Import/Export */}
      {onImport && (
        <ActionButton
          icon={Upload}
          onClick={onImport}
          tooltip="导入 SubAgent"
        />
      )}
      {onExport && (
        <ActionButton
          icon={Download}
          onClick={onExport}
          tooltip="导出 SubAgent"
        />
      )}

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--color-border-subtle)] mx-1" />

      {/* Save */}
      <ActionButton
        icon={Save}
        onClick={onSave}
        disabled={!isDirty && !saveActive}
        tooltip="保存 (⌘S)"
        className={saveActive ? 'text-yellow-400' : undefined}
      />

      {/* Execute/Stop */}
      <ActionButton
        icon={isRunning ? Square : Play}
        onClick={onExecute}
        tooltip={isRunning ? '停止' : '执行 (⌘Enter)'}
        variant={isRunning ? 'danger' : 'primary'}
      />
    </div>
  )
}
