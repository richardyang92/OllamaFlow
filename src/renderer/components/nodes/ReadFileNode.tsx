import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { ReadFileNodeData } from '@/types/node'

function ReadFileNode(props: NodeProps<ReadFileNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon="📄">
      <div className="space-y-3 w-full">
        {/* Primary Badge - File Path */}
        <div className="node-primary-badge file">
          <span className="text-lg">📄</span>
          <span className="font-mono text-sm truncate">
            {data.filePath ? data.filePath.split('/').pop() || data.filePath : '(未设置)'}
          </span>
        </div>

        {/* Secondary Info - Full path and encoding */}
        <div className="node-secondary-info">
          <div className="text-gray-400">
            {data.filePath && data.filePath.includes('/') ? (
              <span className="font-mono text-[10px] truncate block">
                {data.filePath}
              </span>
            ) : null}
          </div>
          <div className="text-gray-500 text-[10px] mt-1.5">
            编码: {data.encoding}
          </div>
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(ReadFileNode)
