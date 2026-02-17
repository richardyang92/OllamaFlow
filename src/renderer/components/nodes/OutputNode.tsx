import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
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

  return (
    <BaseNode {...props} icon="📤">
      <div className="text-xs space-y-2">
        <div className="text-gray-400">类型: {outputTypeLabels[data.outputType]}</div>
        {displayOutput && (
          <div className={cn(
            'bg-white/5 rounded-md p-2',
            'text-zinc-300 font-mono text-xs',
            'border border-white/10',
            'max-h-16',
            'overflow-y-auto',
            'text-left'
          )}>
            <div className="text-gray-500 mb-1">输出:</div>
            <div className="whitespace-pre-wrap break-words">{typeof displayOutput === 'object' && displayOutput !== null ? JSON.stringify(displayOutput, null, 2) : String(displayOutput)}</div>
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(OutputNode)
