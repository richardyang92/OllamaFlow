import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { GitMerge } from 'lucide-react'
import BaseNode from './BaseNode'
import { JoinNodeData } from '@/types/node'

function JoinNode(props: NodeProps<JoinNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon={<GitMerge className="w-4 h-4" />}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge logic">
          <GitMerge className="w-4 h-4" />
          <span className="font-mono font-semibold text-sm">
            {data.inputCount} 路汇聚
          </span>
        </div>

        <div className="node-secondary-info">
          <div className="text-[10px] text-[var(--color-text-muted)]">
            等待所有输入完成后输出
          </div>
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(JoinNode)
