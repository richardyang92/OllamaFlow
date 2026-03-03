import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useRef, useEffect } from 'react'
import { Trash2, ChevronDown, FolderOpen, Folder, ClipboardList } from 'lucide-react'

export default function ExecutionPanel({
  onClose,
  onToggleFiles,
  showFiles,
}: {
  onClose?: () => void
  onToggleFiles: () => void
  showFiles: boolean
}) {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)

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

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-panel)] backdrop-blur-md rounded-lg border border-[var(--color-border-subtle)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text)]">执行日志</span>
          {status === 'running' && (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 bg-yellow-400 rounded-full"
            />
          )}
          {status !== 'idle' && status !== 'running' && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded',
                status === 'completed'
                  ? 'bg-green-500/20 dark:text-green-400 text-green-600 border border-green-500/30'
                  : status === 'failed'
                    ? 'bg-red-500/20 dark:text-red-400 text-red-600 border border-red-500/30'
                    : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]'
              )}
            >
              {status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearLogs}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1 rounded hover:bg-[var(--color-bg-hover)]"
            title="清空日志"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleFiles}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1 rounded hover:bg-[var(--color-bg-hover)]"
            title={showFiles ? '隐藏文件' : '显示文件'}
          >
            {showFiles ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1 rounded hover:bg-[var(--color-bg-hover)]"
              title="收起"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 font-mono text-[10px]">
        {logs.length === 0 ? (
          <div className="text-[var(--color-text-subtle)] text-center py-4">
            <ClipboardList className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
            <p className="text-xs">点击"执行"按钮运行工作流</p>
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
                  'px-2.5 py-1 rounded',
                  'backdrop-blur-sm',
                  'border-l-2',
                  log.level === 'error' && 'bg-red-500/10 border-red-400 dark:text-red-300 text-red-600',
                  log.level === 'warn' && 'bg-yellow-500/10 border-yellow-400 dark:text-yellow-300 text-yellow-700',
                  log.level === 'debug' && 'bg-[var(--color-bg-input)] border-[var(--color-border)] text-[var(--color-text-muted)]',
                  log.level === 'info' && 'bg-blue-500/10 border-blue-400 dark:text-blue-300 text-blue-600'
                )}
              >
                <span className="opacity-50 mr-2 text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {log.nodeName && <span className="text-[var(--color-accent)] mr-1">[{log.nodeName}]</span>}
                <span className="leading-relaxed">{log.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
