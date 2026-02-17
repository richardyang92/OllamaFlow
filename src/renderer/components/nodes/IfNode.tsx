import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { IfNodeData } from '@/types/node'

function IfNode(props: NodeProps<IfNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon="🔀">
      <div className="space-y-3 w-full">
        {/* Primary Badge - Expression Preview */}
        <div className="node-primary-badge logic">
          <span className="text-lg">🔀</span>
          <span className="font-mono font-semibold text-sm truncate">
            {data.expression.length > 20
              ? `${data.expression.substring(0, 20)}...`
              : data.expression || '(condition)'}
          </span>
        </div>

        {/* Secondary Info - Full expression */}
        {data.expression && data.expression.length > 20 && (
          <div className="node-secondary-info">
            <div className="font-mono text-[10px] text-gray-400 truncate">
              {data.expression}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(IfNode)
