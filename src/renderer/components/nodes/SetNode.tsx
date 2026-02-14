import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { SetNodeData } from '@/types/node'

function SetNode(props: NodeProps<SetNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon="✏️">
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Variable:</span>
          <span className="text-white">{data.variableName}</span>
        </div>
        {data.variableValue && (
          <div className="text-gray-500 truncate">
            = {data.variableValue.substring(0, 20)}
            {data.variableValue.length > 20 && '...'}
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(SetNode)
