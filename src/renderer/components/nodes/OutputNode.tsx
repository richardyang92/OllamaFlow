import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { OutputNodeData } from '@/types/node'

function OutputNode(props: NodeProps<OutputNodeData>) {
  const { data } = props

  const outputTypeLabels = {
    display: 'Display',
    copy: 'Copy to clipboard',
    download: 'Download',
  }

  return (
    <BaseNode {...props} icon="📤">
      <div className="text-xs">
        <div className="text-gray-400">Type: {outputTypeLabels[data.outputType]}</div>
      </div>
    </BaseNode>
  )
}

export default memo(OutputNode)
