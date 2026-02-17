import { useExecutionStore } from '@/store/execution-store'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useRef, useEffect } from 'react'

export default function ExecutionPanel({
  onClose,
  onToggleFiles,
  showFiles,
}: {
  onClose?: () => void
  onToggleFiles: () => void
  showFiles: boolean
}) {
  const { logs, status, clearLogs } = useExecutionStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="h-full flex flex-col bg-panel-bg backdrop-blur-md rounded-lg border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-100">执行日志</span>
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
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : status === 'failed'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-500/20 text-zinc-400 border border-slate-500/30'
              )}
            >
              {status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearLogs}
            className="text-zinc-400 hover:text-white text-xs transition-colors"
            title="清空日志"
          >
            🗑️
          </button>
          <button
            onClick={onToggleFiles}
            className="text-zinc-400 hover:text-white text-xs transition-colors"
            title={showFiles ? '隐藏文件' : '显示文件'}
          >
            {showFiles ? '📁' : '📂'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white text-xs transition-colors"
              title="收起"
            >
              ▼
            </button>
          )}
        </div>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 font-mono text-[10px]">
        {logs.length === 0 ? (
          <div className="text-zinc-500 text-center py-4">
            <div className="text-2xl mb-1.5 opacity-50">📋</div>
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
                  log.level === 'error' && 'bg-red-500/10 border-red-400 text-red-300',
                  log.level === 'warn' && 'bg-yellow-500/10 border-yellow-400 text-yellow-300',
                  log.level === 'debug' && 'bg-slate-500/10 border-slate-400 text-zinc-400',
                  log.level === 'info' && 'bg-blue-500/10 border-blue-400 text-blue-300'
                )}
              >
                <span className="opacity-50 mr-2 text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {log.nodeName && <span className="text-neon-blue mr-1">[{log.nodeName}]</span>}
                <span className="leading-relaxed">{log.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
