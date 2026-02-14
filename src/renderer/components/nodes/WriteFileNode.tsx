import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { WriteFileNodeData } from '@/types/node'

function WriteFileNode(props: NodeProps<WriteFileNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon="💾">
      <div className="text-xs space-y-1">
        <div className="text-gray-400">Path:</div>
        <div className="text-white font-mono text-[10px] bg-gray-700 px-2 py-1 rounded truncate">
          {data.filePath || '(not set)'}
        </div>
        <div className="text-gray-500">Mode: {data.writeMode}</div>
      </div>
    </BaseNode>
  )
}

export default memo(WriteFileNode)
