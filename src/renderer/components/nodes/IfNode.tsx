import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import BaseNode from './BaseNode'
import { IfNodeData } from '@/types/node'

function IfNode(props: NodeProps<IfNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon={<GitBranch className="w-4 h-4" />}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge logic">
          <GitBranch className="w-4 h-4" />
          <span className="font-mono font-semibold text-sm truncate">
            {data.expression.length > 20
              ? `${data.expression.substring(0, 20)}...`
              : data.expression || '(condition)'}
          </span>
        </div>

        {data.expression && data.expression.length > 20 && (
          <div className="node-secondary-info">
            <div className="font-mono text-[10px] text-[var(--color-text-muted)] truncate">
              {data.expression}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(IfNode)
