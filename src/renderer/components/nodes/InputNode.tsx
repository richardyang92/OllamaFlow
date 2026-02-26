import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { ArrowDownToLine } from 'lucide-react'
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
    <BaseNode {...props} icon={<ArrowDownToLine className="w-4 h-4" />}>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-[var(--color-text-muted)]">类型:</span>
          <span className="text-[var(--color-text)]">{inputTypeLabels[data.inputType]}</span>
        </div>
        {data.defaultValue && (
          <div className="text-[var(--color-text-subtle)] truncate">
            默认值: {data.defaultValue.substring(0, 20)}
            {data.defaultValue.length > 20 && '...'}
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(InputNode)
