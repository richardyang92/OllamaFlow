import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { ExecuteCommandNodeData } from '@/types/node'

function ExecuteCommandNode(props: NodeProps<ExecuteCommandNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon="⚡">
      <div className="text-xs space-y-1">
        <div className="text-gray-400">Command:</div>
        <div className="text-white font-mono text-[10px] bg-gray-700 px-2 py-1 rounded truncate">
          {data.command || '(not set)'}
        </div>
        <div className="text-gray-500">Timeout: {data.timeout / 1000}s</div>
      </div>
    </BaseNode>
  )
}

export default memo(ExecuteCommandNode)
