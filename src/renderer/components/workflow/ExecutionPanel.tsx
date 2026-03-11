import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useTheme } from '@/contexts/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useRef, useEffect, useState } from 'react'
import { Trash2, ChevronDown, ClipboardList } from 'lucide-react'

export default function ExecutionPanel({
  onClose,
  isDrawer = false,
}: {
  onClose?: () => void
  isDrawer?: boolean
}) {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)
  const { resolvedTheme } = useTheme()
  const [isHovered, setIsHovered] = useState(false)

  // Get current workspace's logs and status
  const logs = useExecutionStore((state) => {
    if (!workspacePath) return []
    return state.getLogsForWorkspace(workspacePath)
  })

  const status = useExecutionStore((state) => {
    if (!workspacePath) return 'idle' as const
    return state.getExecutionStatusForWorkspace(workspacePath)
  })

  const scrollRef = useRef<HTMLDivElement>(null)

  const handleClearLogs = () => {
    if (!workspacePath) return
    useExecutionStore.getState().clearLogsForWorkspace(workspacePath)
  }

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  // Dynamic glow shadow based on theme
  const isDark = resolvedTheme === 'dark'
  const glowColor = isDark ? '255,255,255' : '0,0,0'
  const shadowValue = isHovered
    ? `0 0 30px rgba(${glowColor},0.08), 0 0 60px rgba(${glowColor},0.04)`
    : `0 0 15px rgba(${glowColor},0.05)`

  // In drawer mode, use simpler layout without card styling
  if (isDrawer) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2">
            {status === 'running' && (
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 bg-green-400 rounded-full shadow-lg shadow-green-400/50"
              />
            )}
            {status !== 'idle' && status !== 'running' && (
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium',
                  'transition-colors duration-200',
                  status === 'completed'
                    ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                    : status === 'failed'
                      ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                      : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]'
                )}
              >
                {status === 'completed' ? '✓ 完成' : status === 'failed' ? '✗ 失败' : status}
              </span>
            )}
          </div>
          <button
            onClick={handleClearLogs}
            className={cn(
              'p-1.5 rounded-lg transition-all duration-200',
              'text-[var(--color-text-muted)]',
              'hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]'
            )}
            title="清空日志"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Log entries */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 font-mono text-[11px]">
          {logs.length === 0 ? (
            <div className="text-[var(--color-text-subtle)] text-center py-6">
              <div className={cn(
                'w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center',
                'bg-[var(--color-bg-input)]'
              )}>
                <ClipboardList className="w-5 h-5 opacity-50" />
              </div>
              <p className="text-xs">点击「执行」按钮运行工作流</p>
            </div>
          ) : (
            <AnimatePresence>
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg',
                    'backdrop-blur-sm',
                    'border-l-2',
                    'transition-colors duration-200',
                    log.level === 'error' && 'bg-red-500/10 border-red-400 text-red-400',
                    log.level === 'warn' && 'bg-yellow-500/10 border-yellow-400 text-yellow-400',
                    log.level === 'debug' && 'bg-[var(--color-bg-input)] border-[var(--color-border)] text-[var(--color-text-muted)]',
                    log.level === 'info' && 'bg-blue-500/10 border-blue-400 text-blue-400'
                  )}
                >
                  <span className="opacity-50 mr-2 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  {log.nodeName && <span className="text-purple-400 mr-1">[{log.nodeName}]</span>}
                  <span className="leading-relaxed">{log.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ boxShadow: shadowValue }}
      className={cn(
        'h-full flex flex-col overflow-hidden',
        'bg-[var(--color-bg-elevated)]/80 backdrop-blur-xl',
        'rounded-2xl border border-[var(--color-border)]',
        'transition-all duration-300'
      )}
    >
      {/* Gradient accent bar at top - macOS 26 style */}
      <div className={cn(
        'h-1 w-full flex-shrink-0',
        'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500',
        'opacity-70 transition-opacity duration-300',
        isHovered && 'opacity-100',
        status === 'running' && 'opacity-100'
      )} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text)]">执行日志</span>
          {status === 'running' && (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2 h-2 bg-green-400 rounded-full shadow-lg shadow-green-400/50"
            />
          )}
          {status !== 'idle' && status !== 'running' && (
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-medium',
                'transition-colors duration-200',
                status === 'completed'
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : status === 'failed'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]'
              )}
            >
              {status === 'completed' ? '✓ 完成' : status === 'failed' ? '✗ 失败' : status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClearLogs}
            className={cn(
              'p-1.5 rounded-lg transition-all duration-200',
              'text-[var(--color-text-muted)]',
              'hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]'
            )}
            title="清空日志"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                'p-1.5 rounded-lg transition-all duration-200',
                'text-[var(--color-text-muted)]',
                'hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]'
              )}
              title="收起"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 font-mono text-[11px]">
        {logs.length === 0 ? (
          <div className="text-[var(--color-text-subtle)] text-center py-6">
            <div className={cn(
              'w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center',
              'bg-[var(--color-bg-input)]'
            )}>
              <ClipboardList className="w-5 h-5 opacity-50" />
            </div>
            <p className="text-xs">点击「执行」按钮运行工作流</p>
          </div>
        ) : (
          <AnimatePresence>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'px-3 py-1.5 rounded-lg',
                  'backdrop-blur-sm',
                  'border-l-2',
                  'transition-colors duration-200',
                  log.level === 'error' && 'bg-red-500/10 border-red-400 text-red-400',
                  log.level === 'warn' && 'bg-yellow-500/10 border-yellow-400 text-yellow-400',
                  log.level === 'debug' && 'bg-[var(--color-bg-input)] border-[var(--color-border)] text-[var(--color-text-muted)]',
                  log.level === 'info' && 'bg-blue-500/10 border-blue-400 text-blue-400'
                )}
              >
                <span className="opacity-50 mr-2 text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {log.nodeName && <span className="text-purple-400 mr-1">[{log.nodeName}]</span>}
                <span className="leading-relaxed">{log.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
