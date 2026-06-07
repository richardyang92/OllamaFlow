import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Loader2,
  PanelLeft,
  ArrowLeft,
  Sparkles,
  LayoutGrid,
  Workflow,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePanelContext } from '@/contexts/PanelContext'
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext'

import { Logo } from './Logo'
import { OllamaStatus } from './OllamaStatus'
import { GlobalAIConfigButton } from './GlobalAIConfigButton'
import { WorkflowActions } from './WorkflowActions'
import type { AppHeaderProps } from './types'

// 极简图标按钮 — 无背景、无圆角、纯图标 + tooltip
function IconButton({
  icon: Icon,
  onClick,
  disabled,
  title,
  active,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
  disabled?: boolean
  title?: string
  active?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded-md',
        'text-[var(--color-text-muted)]',
        'transition-colors duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        active
          ? 'text-[var(--color-accent)] bg-[var(--color-accent-bg)]'
          : 'hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]',
        className
      )}
    >
      <Icon className="w-[18px] h-[18px]" />
    </button>
  )
}

// 导航链接按钮 — 带文字，用于主要导航
function NavButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium',
        'transition-colors duration-150',
        active
          ? 'text-[var(--color-accent)] bg-[var(--color-accent-bg)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]'
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  )
}

// 主题切换按钮
function ThemeToggleButton() {
  const { themeMode, setThemeMode, resolvedTheme } = useTheme()

  const cycleTheme = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(themeMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setThemeMode(nextMode)
  }

  const ThemeIcon = themeMode === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun

  return (
    <IconButton
      icon={ThemeIcon}
      onClick={cycleTheme}
      title={`主题: ${themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色'}`}
    />
  )
}

export function AppHeader({
  page,
  workspaceName = '未命名',
  workspaceDescription = '',
  isDirty = false,
  executionStatus = 'idle',
  saveActive = false,
  onSave,
  onClose,
  onExecute,
  onExport,
  onImport,
  onEditInfo,
  onSettings,
  onToggleLogs,
  showLogsPanel = false,
  isRunning = false,
  conversationTitle,
  onGoToAgent,
  onGoToEditor,
  onGoToWelcome,
}: AppHeaderProps) {
  const isMac = useMemo(() => window.electronAPI.platform.isMac(), [])

  const showWorkflowActions = page === 'editor'
  const showWelcomeActions = page === 'welcome'
  const showAgentActions = page === 'agent'

  // Side panel state - only used in editor page
  let sidePanelVisible = false
  let toggleSidePanel = () => {}
  if (showWorkflowActions) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const panelContext = usePanelContext()
    sidePanelVisible = panelContext.sidePanelVisible
    toggleSidePanel = panelContext.toggleSidePanel
  }

  // Settings state for Welcome page
  const [defaultProjectsPath, setDefaultProjectsPath] = useState<string>('')
  const [isChangingPath, setIsChangingPath] = useState(false)

  useEffect(() => {
    window.electronAPI.workspace.getDefaultProjectsPath().then(setDefaultProjectsPath)
  }, [])

  const handleChangeDefaultPath = async () => {
    if (isChangingPath) return
    setIsChangingPath(true)
    try {
      const selectedPath = await window.electronAPI.workspace.selectCustomProjectsPath()
      if (selectedPath) {
        await window.electronAPI.workspace.setCustomProjectsPath(selectedPath)
        setDefaultProjectsPath(selectedPath)
      }
    } catch (error) {
      console.error('更改默认路径失败:', error)
      alert('更改默认路径失败')
    } finally {
      setIsChangingPath(false)
    }
  }

  // macOS drag region offset
  const macOSLeftOffset = isMac ? 'left-[72px]' : 'left-0'

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-12 flex items-center',
        macOSLeftOffset,
        'bg-[var(--color-bg-elevated)]/80 backdrop-blur-md',
        'border-b border-[var(--color-border-subtle)]'
      )}
      style={isMac ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
    >
      {/* Left section */}
      <div className="flex items-center gap-1 px-3">
        {showAgentActions ? (
          <>
            {/* Logo — 更 subtle */}
            <div className="flex items-center gap-2 mr-4">
              <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
              <span className="text-sm font-semibold text-[var(--color-text)] tracking-tight">
                OllamaFlow
              </span>
              {isRunning && (
                <Loader2 className="w-3 h-3 text-[var(--color-text-muted)] animate-spin" />
              )}
            </div>

            {/* 主导航 */}
            <div className="flex items-center gap-0.5">
              <NavButton
                icon={LayoutGrid}
                label="项目"
                onClick={onGoToWelcome}
                active={false}
              />
              <NavButton
                icon={Workflow}
                label="工具"
                onClick={onGoToEditor}
                active={false}
              />
            </div>
          </>
        ) : (
          <>
            {/* 返回主页 */}
            <button
              onClick={onGoToAgent}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium',
                'text-[var(--color-text-muted)]',
                'hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]',
                'transition-colors duration-150'
              )}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>主页</span>
            </button>

            {/* 页面标题 */}
            <div className="ml-3 flex items-center gap-2">
              {showWorkflowActions && (
                <>
                  <Workflow className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-sm font-medium text-[var(--color-text)] truncate max-w-[180px]">
                    {workspaceName}
                    {isDirty && (
                      <span className="text-[var(--color-accent)] ml-1">•</span>
                    )}
                  </span>
                </>
              )}
              {showWelcomeActions && (
                <>
                  <LayoutGrid className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-sm font-medium text-[var(--color-text)]">项目管理</span>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Center — 对话标题 (Agent only, 更 subtle) */}
      {showAgentActions && conversationTitle && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[200px]">
            {conversationTitle}
          </span>
        </div>
      )}

      {/* Right section */}
      <div className="flex items-center gap-0.5 px-3">
        {showWorkflowActions && (
          <>
            <WorkflowActions
              workspaceName={workspaceName}
              workspaceDescription={workspaceDescription}
              isDirty={isDirty}
              executionStatus={executionStatus}
              saveActive={saveActive}
              onSave={onSave!}
              onExecute={onExecute!}
              onExport={onExport}
              onImport={onImport}
              onEditInfo={onEditInfo}
            />
            <div className="w-px h-4 bg-[var(--color-border-subtle)] mx-1" />
          </>
        )}

        {showWelcomeActions && (
          <>
            <GlobalAIConfigButton />
            <button
              onClick={handleChangeDefaultPath}
              disabled={isChangingPath}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium',
                'text-[var(--color-text-muted)]',
                'hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]',
                'transition-colors duration-150',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
              title={`默认保存位置: ${defaultProjectsPath}`}
            >
              {isChangingPath ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Settings className="w-3.5 h-3.5" />
              )}
              <span>路径</span>
            </button>
            <div className="w-px h-4 bg-[var(--color-border-subtle)] mx-1" />
            <OllamaStatus />
          </>
        )}

        {showAgentActions && (
          <>
            <IconButton
              icon={Settings}
              onClick={onSettings}
              title="设置"
            />
          </>
        )}

        <ThemeToggleButton />

        {showAgentActions && (
          <>
            <div className="w-px h-4 bg-[var(--color-border-subtle)] mx-1" />
            <IconButton
              icon={PanelLeft}
              onClick={onToggleLogs}
              title={showLogsPanel ? '隐藏面板' : '显示面板'}
              active={showLogsPanel}
            />
          </>
        )}

        {showWorkflowActions && (
          <>
            <div className="w-px h-4 bg-[var(--color-border-subtle)] mx-1" />
            <IconButton
              icon={PanelLeft}
              onClick={toggleSidePanel}
              title="面板 (⌘1)"
              active={sidePanelVisible}
            />
          </>
        )}
      </div>
    </header>
  )
}
