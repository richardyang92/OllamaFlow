import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { ExecuteCommandNodeData } from '@/types/node'

function ExecuteCommandNode(props: NodeProps<ExecuteCommandNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon="⚡">
      <div className="space-y-3 w-full">
        {/* Primary Badge - Command */}
        <div className="node-primary-badge system">
          <span className="text-lg">⚡</span>
          <span className="font-mono font-semibold truncate text-sm">
            {data.command ? data.command.split(' ')[0] : '(未设置)'}
          </span>
        </div>

        {/* Secondary Info - Full command and timeout */}
        <div className="node-secondary-info">
          <div className="text-gray-400">
            {data.command && data.command.split(' ').length > 1 ? (
              <span className="font-mono text-[10px] truncate block">
                {data.command}
              </span>
            ) : (
              <span className="text-gray-500">无命令</span>
            )}
          </div>
          <div className="text-gray-500 text-[10px] mt-1.5">
            超时: {data.timeout / 1000}s
          </div>
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(ExecuteCommandNode)
