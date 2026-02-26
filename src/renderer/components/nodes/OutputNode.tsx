import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { ArrowUpFromLine } from 'lucide-react'
import BaseNode from './BaseNode'
import { OutputNodeData } from '@/types/node'
import { cn } from '@/lib/utils'
import { useExecutionStore } from '@/store/execution-store'

function OutputNode(props: NodeProps<OutputNodeData>) {
  const { data, id } = props
  const nodeResult = useExecutionStore((state) => state.getNodeStatus(id))
  const output = nodeResult?.output
  const displayOutput = output && typeof output === 'object' && output !== null && 'data' in output ? output.data : output

  const outputTypeLabels = {
    display: '显示',
    copy: '复制到剪贴板',
    download: '下载',
  }

  const sourceTypeLabels = {
    input: '输入值',
    variable: '变量',
  }

  return (
    <BaseNode {...props} icon={<ArrowUpFromLine className="w-4 h-4" />}>
      <div className="text-xs space-y-2">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">来源</span>
            <span className="text-[var(--color-text)]">{sourceTypeLabels[data.sourceType || 'input']}
              {data.sourceType === 'variable' && data.variableName && (
                <span className="text-[var(--color-node-input)]">({data.variableName})</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">类型</span>
            <span className="text-[var(--color-text)]">{outputTypeLabels[data.outputType]}</span>
          </div>
        </div>
        {displayOutput && (
          <div className={cn(
            'bg-[var(--color-bg-input)] rounded-md p-2',
            'text-[var(--color-text)] font-mono text-xs',
            'border border-[var(--color-border-subtle)]',
            'max-h-16',
            'overflow-y-auto',
            'text-left'
          )}>
            <div className="text-[var(--color-text-subtle)] mb-1">输出:</div>
            <div className="whitespace-pre-wrap break-words">{typeof displayOutput === 'object' && displayOutput !== null ? JSON.stringify(displayOutput, null, 2) : String(displayOutput)}</div>
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(OutputNode)
