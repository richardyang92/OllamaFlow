import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { Split } from 'lucide-react'
import BaseNode from './BaseNode'
import { SplitterNodeData } from '@/types/node'

function SplitterNode(props: NodeProps<SplitterNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon={<Split className="w-4 h-4" />}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge logic">
          <Split className="w-4 h-4" />
          <span className="font-mono font-semibold text-sm">
            {data.outputCount} 路输出
          </span>
        </div>

        <div className="node-secondary-info">
          <div className="text-[10px] text-[var(--color-text-muted)]">
            输入同时分发到所有输出
          </div>
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(SplitterNode)
