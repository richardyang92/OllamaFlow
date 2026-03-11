import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Settings, Loader2, PanelLeft, ArrowLeft, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePanelContext } from '@/contexts/PanelContext'

import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { OllamaStatus } from './OllamaStatus'
import { GlobalAIConfigButton } from './GlobalAIConfigButton'
import { WorkflowActions } from './WorkflowActions'
import type { AppHeaderProps } from './types'

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
  // Agent 页面属性
  onSettings,
  onToggleLogs,
  showLogsPanel = false,
  isRunning = false,
}: AppHeaderProps) {
  // Platform detection
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

  // macOS layout
  if (isMac) {
    return (
      <header
        className="fixed top-0 left-[72px] right-4 z-20 h-14 flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Left section: Logo */}
        {showAgentActions ? (
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full',
                'text-[var(--color-text-muted)] text-xs font-medium',
                'bg-gradient-to-r from-violet-500/10 to-purple-500/10',
                'border border-violet-500/20',
                'hover:from-violet-500/20 hover:to-purple-500/20',
                'hover:border-violet-500/30 hover:text-purple-400',
                'transition-all duration-200 cursor-pointer'
              )}
              title="关闭智能助手"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>返回</span>
            </motion.button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium">智能助手</span>
              {isRunning && (
                <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              )}
            </div>
          </div>
        ) : (
          <Logo compact onBack={showWorkflowActions ? onClose : undefined} />
        )}

        {/* Flexible spacer */}
        <div className="flex-1" />

        {/* Right section */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1"
        >
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
              <motion.button
                onClick={handleChangeDefaultPath}
                disabled={isChangingPath}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                  'text-[var(--color-text-muted)]',
                  'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                whileHover={{ scale: isChangingPath ? 1 : 1.02 }}
                whileTap={{ scale: isChangingPath ? 1 : 0.98 }}
                title={`默认保存位置: ${defaultProjectsPath}`}
              >
                {isChangingPath ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Settings className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">路径</span>
              </motion.button>
              <div className="w-px h-4 bg-[var(--color-border-subtle)] mx-1" />
              <OllamaStatus />
            </>
          )}

          {showAgentActions && (
            <>
              <div className="w-px h-4 bg-[var(--color-border-subtle)] mx-1" />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onSettings}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  'text-[var(--color-text-muted)]',
                  'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
                  'transition-all duration-200'
                )}
                title="设置"
              >
                <Settings className="w-4 h-4" />
              </motion.button>
            </>
          )}

          <ThemeToggle />

          {showAgentActions && (
            <>
              <div className="w-px h-4 bg-[var(--color-border-subtle)] mx-1" />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleLogs}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  'transition-all duration-200',
                  showLogsPanel
                    ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
                )}
                title={showLogsPanel ? '隐藏面板' : '显示面板'}
              >
                <PanelLeft className="w-4 h-4" />
              </motion.button>
            </>
          )}

          {showWorkflowActions && (
            <>
              <div className="w-px h-4 bg-[var(--color-border-subtle)] mx-1" />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleSidePanel}
                title="面板 (⌘1)"
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  'transition-all duration-200',
                  sidePanelVisible
                    ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
                )}
              >
                <PanelLeft className="w-4 h-4" />
              </motion.button>
            </>
          )}
        </motion.div>
      </header>
    )
  }

  // Windows/Linux: Floating card layout
  return (
    <header className="fixed top-4 left-4 right-4 z-20">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'flex items-center justify-between px-4 py-2.5 rounded-2xl',
            'glass-floating',
            'transition-all duration-300'
          )}
        >
          {/* Logo section */}
          {showAgentActions ? (
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ x: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full',
                  'text-[var(--color-text-muted)] text-xs font-medium',
                  'bg-gradient-to-r from-violet-500/10 to-purple-500/10',
                  'border border-violet-500/20',
                  'hover:from-violet-500/20 hover:to-purple-500/20',
                  'hover:border-violet-500/30 hover:text-purple-400',
                  'transition-all duration-200 cursor-pointer'
                )}
                title="关闭智能助手"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>返回</span>
              </motion.button>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium">智能助手</span>
                {isRunning && (
                  <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                )}
              </div>
            </div>
          ) : (
            <Logo onBack={showWorkflowActions ? onClose : undefined} />
          )}

          {/* Right controls */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5"
          >
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
                <div className="w-px h-5 bg-[var(--color-border-subtle)] mx-1" />
              </>
            )}

            {showWelcomeActions && (
              <>
                <GlobalAIConfigButton />
                <motion.button
                  onClick={handleChangeDefaultPath}
                  disabled={isChangingPath}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium',
                    'text-[var(--color-text-muted)]',
                    'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
                    'transition-all duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  whileHover={{ scale: isChangingPath ? 1 : 1.02 }}
                  whileTap={{ scale: isChangingPath ? 1 : 0.98 }}
                  title={`默认保存位置: ${defaultProjectsPath}`}
                >
                  {isChangingPath ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Settings className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">路径</span>
                </motion.button>
                <div className="w-px h-5 bg-[var(--color-border-subtle)] mx-1" />
                <OllamaStatus />
              </>
            )}

            {showAgentActions && (
              <>
                <div className="w-px h-5 bg-[var(--color-border-subtle)] mx-1" />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onSettings}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    'text-[var(--color-text-muted)]',
                    'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
                    'transition-all duration-200'
                  )}
                  title="设置"
                >
                  <Settings className="w-4 h-4" />
                </motion.button>
              </>
            )}

            <ThemeToggle />

            {showAgentActions && (
              <>
                <div className="w-px h-5 bg-[var(--color-border-subtle)] mx-1" />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onToggleLogs}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    'transition-all duration-200',
                    showLogsPanel
                      ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
                  )}
                  title={showLogsPanel ? '隐藏面板' : '显示面板'}
                >
                  <PanelLeft className="w-4 h-4" />
                </motion.button>
              </>
            )}

            {showWorkflowActions && (
              <>
                <div className="w-px h-5 bg-[var(--color-border-subtle)] mx-1" />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleSidePanel}
                  title="面板 (⌘1)"
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    'transition-all duration-200',
                    sidePanelVisible
                      ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
                  )}
                >
                  <PanelLeft className="w-4 h-4" />
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>
      </div>
    </header>
  )
}
