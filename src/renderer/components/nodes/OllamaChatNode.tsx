import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { OllamaChatNodeData } from '@/types/node'

function OllamaChatNode(props: NodeProps<OllamaChatNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon="🤖">
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Model:</span>
          <span className="text-white truncate max-w-[100px]">{data.model}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Temp:</span>
          <span className="text-white">{data.temperature}</span>
        </div>
        {data.stream && (
          <div className="text-blue-400">Stream: ON</div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(OllamaChatNode)
