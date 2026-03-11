import { useAgentStore } from '@/store/agent-store'
import { cn } from '@/lib/utils'

export default function ExecutionLogPanel() {
  const { executionLogs, clearExecutionLogs } = useAgentStore()

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 - 清空按钮 */}
      {executionLogs.length > 0 && (
        <div className="px-3 py-2 border-b border-[var(--color-border-subtle)] flex justify-end">
          <button
            onClick={clearExecutionLogs}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
          >
            清空
          </button>
        </div>
      )}

      {/* 日志列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {executionLogs.length === 0 ? (
          <div className="text-xs text-[var(--color-text-muted)] text-center py-4">
            暂无日志
          </div>
        ) : (
          executionLogs.map((log) => (
            <div
              key={log.id}
              className={cn(
                'text-xs font-mono p-2 rounded',
                log.level === 'error' && 'text-red-400 bg-red-500/5',
                log.level === 'warn' && 'text-yellow-400 bg-yellow-500/5',
                log.level === 'info' && 'text-[var(--color-text)] bg-[var(--color-bg-input)]',
                log.level === 'debug' && 'text-[var(--color-text-muted)] bg-[var(--color-bg-input)]/50'
              )}
            >
              <span className="text-[var(--color-text-muted)] mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
