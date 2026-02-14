import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { WorkflowNodeData } from '@/types/node'
import { cn } from '@/lib/utils'

interface BaseNodeProps extends NodeProps<WorkflowNodeData> {
  children?: React.ReactNode
  icon?: string
  className?: string
}

const statusColors = {
  idle: 'border-gray-600',
  running: 'border-yellow-500 animate-pulse',
  success: 'border-green-500',
  error: 'border-red-500',
}

const statusDots = {
  idle: 'bg-gray-400',
  running: 'bg-yellow-400 animate-pulse',
  success: 'bg-green-400',
  error: 'bg-red-400',
}

function BaseNode({ id, data, selected, children, icon, className }: BaseNodeProps) {
  const status = data.status || 'idle'
  const inputCount = data.inputs.length
  const outputCount = data.outputs.length

  return (
    <div
      className={cn(
        'min-w-[180px] max-w-[250px] rounded-lg bg-gray-800 shadow-lg border-2 transition-all',
        statusColors[status],
        selected && 'ring-2 ring-blue-500',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-750 rounded-t-lg">
        <div className={cn('w-2.5 h-2.5 rounded-full', statusDots[status])} />
        {icon && <span className="text-base">{icon}</span>}
        <span className="font-medium text-sm truncate flex-1">{data.label}</span>
      </div>

      {/* Content */}
      <div className="px-3 py-2">{children}</div>

      {/* Input Handles */}
      {data.inputs.map((input, index) => (
        <Handle
          key={`input-${input.id}`}
          type="target"
          position={Position.Left}
          id={input.id}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600 hover:!bg-blue-400 transition-colors"
          style={{
            top: inputCount === 1 ? '50%' : `${((index + 1) / (inputCount + 1)) * 100}%`,
          }}
          title={input.label}
        />
      ))}

      {/* Output Handles */}
      {data.outputs.map((output, index) => (
        <Handle
          key={`output-${output.id}`}
          type="source"
          position={Position.Right}
          id={output.id}
          className="!w-3 !h-3 !bg-blue-400 !border-2 !border-blue-600 hover:!bg-blue-300 transition-colors"
          style={{
            top: outputCount === 1 ? '50%' : `${((index + 1) / (outputCount + 1)) * 100}%`,
          }}
          title={output.label}
        />
      ))}

      {/* Error message */}
      {data.error && (
        <div className="px-3 py-1 bg-red-900/30 text-red-400 text-xs rounded-b-lg">
          {data.error}
        </div>
      )}
    </div>
  )
}

export default memo(BaseNode)
