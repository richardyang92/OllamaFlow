import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { InputNodeData } from '@/types/node'

function InputNode(props: NodeProps<InputNodeData>) {
  const { data } = props

  const inputTypeLabels = {
    string: '文本',
    number: '数字',
    boolean: '布尔值',
  }

  return (
    <BaseNode {...props} icon="📥">
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">类型:</span>
          <span className="text-white">{inputTypeLabels[data.inputType]}</span>
        </div>
        {data.defaultValue && (
          <div className="text-gray-500 truncate">
            默认值: {data.defaultValue.substring(0, 20)}
            {data.defaultValue.length > 20 && '...'}
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(InputNode)
