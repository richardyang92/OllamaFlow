import type { ExecutionStatus } from '@/types/execution'

export type AppPage = 'welcome' | 'editor' | 'agent'

export interface AppHeaderProps {
  page: AppPage
  // Editor 页面专用属性
  workspaceName?: string
  workspaceDescription?: string
  isDirty?: boolean
  executionStatus?: ExecutionStatus
  saveActive?: boolean
  onSave?: () => void
  onClose?: () => void
  onExecute?: () => void
  onExport?: () => void
  onImport?: () => void
  onEditInfo?: (name: string, description: string) => void
  // Agent 页面专用属性
  onSettings?: () => void
  onToggleLogs?: () => void
  showLogsPanel?: boolean
  isRunning?: boolean
  conversationTitle?: string
}

export interface AppHeaderButtonProps {
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
  disabled?: boolean
  tooltip?: string
  variant?: 'default' | 'primary' | 'danger' | 'active'
  showLabel?: boolean
  label?: string
  badge?: React.ReactNode
  className?: string
}
