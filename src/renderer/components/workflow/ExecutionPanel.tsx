import { useExecutionStore } from '@/store/execution-store'

export default function ExecutionPanel({
  onToggleFiles,
  showFiles,
}: {
  onToggleFiles: () => void
  showFiles: boolean
}) {
  const { logs, status } = useExecutionStore()

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">📋 Execution Log</span>
          {status !== 'idle' && (
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                status === 'running'
                  ? 'bg-yellow-600'
                  : status === 'completed'
                    ? 'bg-green-600'
                    : status === 'failed'
                      ? 'bg-red-600'
                      : 'bg-gray-600'
              }`}
            >
              {status}
            </span>
          )}
        </div>
        <button
          onClick={onToggleFiles}
          className="text-gray-400 hover:text-white text-xs"
        >
          {showFiles ? '📁' : '📂'}
        </button>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            No execution logs. Click "Execute" to run the workflow.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`py-1 ${
                log.level === 'error'
                  ? 'text-red-400'
                  : log.level === 'warn'
                    ? 'text-yellow-400'
                    : log.level === 'debug'
                      ? 'text-gray-500'
                      : 'text-gray-300'
              }`}
            >
              <span className="text-gray-500 mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {log.nodeName && <span className="text-blue-400 mr-1">[{log.nodeName}]</span>}
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
