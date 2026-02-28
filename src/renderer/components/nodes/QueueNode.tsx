import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { ListOrdered } from 'lucide-react'
import BaseNode from './BaseNode'
import { QueueNodeData } from '@/types/node'

function QueueNode(props: NodeProps<QueueNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon={<ListOrdered className="w-4 h-4" />}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge logic">
          <ListOrdered className="w-4 h-4" />
          <span className="font-mono font-semibold text-sm">
            {data.inputCount} 路输入
          </span>
        </div>

        <div className="node-secondary-info">
          <div className="text-[10px] text-[var(--color-text-muted)]">
            入队 → 出队透传
          </div>
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(QueueNode)
