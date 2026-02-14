import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { ManualTriggerNodeData } from '@/types/node'

function ManualTriggerNode(props: NodeProps<ManualTriggerNodeData>) {
  return (
    <BaseNode {...props} icon="▶️">
      <div className="text-xs text-gray-400">Click to start workflow</div>
    </BaseNode>
  )
}

export default memo(ManualTriggerNode)
