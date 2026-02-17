import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { WriteFileNodeData } from '@/types/node'
import { cn } from '@/lib/utils'

function WriteFileNode(props: NodeProps<WriteFileNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon="💾">
      <div className="space-y-3 w-full">
        {/* Primary Badge - File Path */}
        <div className="node-primary-badge file">
          <span className="text-lg">💾</span>
          <span className="font-mono text-sm truncate">
            {data.filePath ? data.filePath.split('/').pop() || data.filePath : '(未设置)'}
          </span>
        </div>

        {/* Secondary Info - Full path and mode */}
        <div className="node-secondary-info flex justify-between items-center">
          <div className="text-gray-400 flex-1">
            {data.filePath && data.filePath.includes('/') ? (
              <span className="font-mono text-[10px] truncate block">
                {data.filePath}
              </span>
            ) : (
              <span className="text-gray-500">无路径</span>
            )}
          </div>
          <span className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded",
            data.writeMode === 'overwrite'
              ? "bg-orange-500/20 text-orange-400"
              : "bg-blue-500/20 text-blue-400"
          )}>
            {data.writeMode === 'overwrite' ? '覆盖' : '追加'}
          </span>
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(WriteFileNode)
