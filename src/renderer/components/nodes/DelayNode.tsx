import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { Clock } from 'lucide-react'
import BaseNode from './BaseNode'
import { DelayNodeData } from '@/types/node'

function DelayNode(props: NodeProps<DelayNodeData>) {
  const { data } = props

  const formatDelay = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  }

  return (
    <BaseNode {...props} icon={<Clock className="w-4 h-4" />}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge logic">
          <Clock className="w-4 h-4" />
          <span className="font-medium truncate text-sm">延迟</span>
        </div>

        <div className="node-secondary-info">
          <div className="flex justify-between text-[10px]">
            <span className="text-[var(--color-text-subtle)]">等待时间</span>
            <span className="text-[var(--color-text)] font-mono">{formatDelay(data.delayMs)}</span>
          </div>
          <div className="flex justify-between text-[10px] mt-1.5">
            <span className="text-[var(--color-text-subtle)]">透传数据</span>
            <span className={data.passthrough ? 'text-green-500' : 'text-[var(--color-text-muted)]'}>
              {data.passthrough ? '是' : '否'}
            </span>
          </div>
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(DelayNode)
