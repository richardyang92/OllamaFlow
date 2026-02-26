import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { FileText } from 'lucide-react'
import BaseNode from './BaseNode'
import { ReadFileNodeData } from '@/types/node'

function ReadFileNode(props: NodeProps<ReadFileNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon={<FileText className="w-4 h-4" />}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge file">
          <FileText className="w-4 h-4" />
          <span className="font-mono text-sm truncate">
            {data.filePath ? data.filePath.split('/').pop() || data.filePath : '(未设置)'}
          </span>
        </div>

        <div className="node-secondary-info">
          <div className="text-[var(--color-text-muted)]">
            {data.filePath && data.filePath.includes('/') ? (
              <span className="font-mono text-[10px] truncate block">
                {data.filePath}
              </span>
            ) : null}
          </div>
          <div className="text-[var(--color-text-subtle)] text-[10px] mt-1.5">
            编码: {data.encoding}
          </div>
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(ReadFileNode)
