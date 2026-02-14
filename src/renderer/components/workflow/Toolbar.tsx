import type { ExecutionStatus } from '@/types/execution'

interface ToolbarProps {
  workspaceName: string
  isDirty: boolean
  executionStatus: ExecutionStatus
  onSave: () => void
  onClose: () => void
  onExecute: () => void
}

export default function Toolbar({
  workspaceName,
  isDirty,
  executionStatus,
  onSave,
  onClose,
  onExecute,
}: ToolbarProps) {
  return (
    <div className="h-12 flex items-center justify-between px-4 bg-gray-800 border-b border-gray-700">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
          title="Close Workspace"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">📁</span>
          <span className="font-medium">{workspaceName}</span>
          {isDirty && <span className="text-yellow-500">●</span>}
        </div>
      </div>

      {/* Center */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={!isDirty}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm transition-colors"
        >
          💾 Save
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <button
          onClick={onExecute}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            executionStatus === 'running'
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {executionStatus === 'running' ? '⏹ Stop' : '▶ Execute'}
        </button>
      </div>
    </div>
  )
}
