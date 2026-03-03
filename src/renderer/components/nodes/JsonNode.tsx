import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { Braces } from 'lucide-react'
import BaseNode from './BaseNode'
import { JsonNodeData, JsonNodeMode } from '@/types/node'

const modeLabels: Record<JsonNodeMode, string> = {
  parse: '解析',
  stringify: '字符串化',
  extract: '提取',
  merge: '合并',
}

const modeDescriptions: Record<JsonNodeMode, string> = {
  parse: 'JSON → 对象',
  stringify: '对象 → JSON',
  extract: '提取字段',
  merge: '合并对象',
}

function JsonNode(props: NodeProps<JsonNodeData>) {
  const { data } = props

  return (
    <BaseNode {...props} icon={<Braces className="w-4 h-4" />}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge data">
          <Braces className="w-4 h-4" />
          <span className="font-medium truncate text-sm">
            {modeLabels[data.mode]}
          </span>
        </div>

        <div className="node-secondary-info">
          <div className="text-[10px] text-[var(--color-text-muted)]">
            {modeDescriptions[data.mode]}
          </div>
          {data.mode === 'extract' && data.jsonPath && (
            <div className="text-[10px] mt-1.5 font-mono text-[var(--color-text-subtle)] truncate">
              {data.jsonPath}
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(JsonNode)
