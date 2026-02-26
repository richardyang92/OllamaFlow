import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { Terminal } from 'lucide-react'
import BaseNode from './BaseNode'
import { ExecuteCommandNodeData } from '@/types/node'

function ExecuteCommandNode(props: NodeProps<ExecuteCommandNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon={<Terminal className="w-4 h-4" />}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge system">
          <Terminal className="w-4 h-4" />
          <span className="font-mono font-semibold truncate text-sm">
            {data.command ? data.command.split(' ')[0] : '(未设置)'}
          </span>
        </div>

        <div className="node-secondary-info">
          <div className="text-[var(--color-text-muted)]">
            {data.command && data.command.split(' ').length > 1 ? (
              <span className="font-mono text-[10px] truncate block">
                {data.command}
              </span>
            ) : (
              <span className="text-[var(--color-text-subtle)]">无命令</span>
            )}
          </div>
          <div className="text-[var(--color-text-subtle)] text-[10px] mt-1.5">
            超时: {data.timeout / 1000}s
          </div>
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(ExecuteCommandNode)
