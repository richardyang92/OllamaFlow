import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { OllamaChatNodeData } from '@/types/node'
import { useStreamOutput } from '@/hooks/useStreamOutput'

function OllamaChatNode(props: NodeProps<OllamaChatNodeData>) {
  const { data, id } = props
  const streamOutput = useStreamOutput(id)

  return (
    <BaseNode {...props} icon="🤖">
      <div className="space-y-1 text-xs w-full">
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
        
        {/* Show streaming output if available */}
        {streamOutput && (
          <div className="mt-2 pt-2 border-t border-gray-600">
            <div className="text-xs text-gray-400 mb-1">Output:</div>
            <div className="text-xs text-gray-300 max-h-20 overflow-y-auto whitespace-pre-wrap break-words">
              {streamOutput}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(OllamaChatNode)
