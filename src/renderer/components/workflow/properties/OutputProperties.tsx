import type { WorkflowNode, OutputNodeData } from '@/types/node'
import { cn } from '@/lib/utils'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<OutputNodeData>) => void
}

export default function OutputProperties({ node, updateNodeData }: Props) {
  const data = node.data as OutputNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">输出方式</label>
        <select
          value={data.outputType}
          onChange={(e) => updateNodeData(node.id, { outputType: e.target.value as OutputNodeData['outputType'] })}
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-white/5',
            'border border-white/10',
            'text-white text-sm',
            'focus:outline-none focus:border-white/20 focus:bg-white/8',
            'transition-all duration-200',
            'select-sci-fi'
          )}
        >
          <option value="display">在执行面板中显示</option>
          <option value="copy">复制到剪贴板</option>
          <option value="download">下载为文件</option>
        </select>
      </div>

      <div className="bg-white/5 rounded-lg p-3 text-xs text-zinc-400 border border-white/5">
        <div className="font-medium text-zinc-300 mb-1">说明：</div>
        {data.outputType === 'display' && (
          <div>在执行面板中显示输出内容，适合查看中间结果</div>
        )}
        {data.outputType === 'copy' && (
          <div>将输出内容复制到系统剪贴板，方便粘贴使用</div>
        )}
        {data.outputType === 'download' && (
          <div>将输出内容下载为文本文件，默认文件名为 output.txt</div>
        )}
      </div>
    </div>
  )
}
