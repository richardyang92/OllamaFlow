import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { IfNodeData } from '@/types/node'

function IfNode(props: NodeProps<IfNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon="🔀">
      <div className="text-xs">
        <div className="text-gray-400 mb-1">Condition:</div>
        <div className="text-white font-mono text-[10px] bg-gray-700 px-2 py-1 rounded truncate">
          {data.expression.substring(0, 25)}
          {data.expression.length > 25 && '...'}
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(IfNode)
