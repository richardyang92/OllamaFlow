import type { WorkflowNode, WriteFileNodeData } from '@/types/node'
import { cn } from '@/lib/utils'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<WriteFileNodeData>) => void
}

export default function WriteFileProperties({ node, updateNodeData }: Props) {
  const data = node.data as WriteFileNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          文件路径
          <span className="text-zinc-500 ml-1">(相对于工作区)</span>
        </label>
        <input
          type="text"
          value={data.filePath}
          onChange={(e) => updateNodeData(node.id, { filePath: e.target.value })}
          placeholder="data/output.txt"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">写入模式</label>
        <select
          value={data.writeMode}
          onChange={(e) => updateNodeData(node.id, { writeMode: e.target.value as WriteFileNodeData['writeMode'] })}
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
          <option value="overwrite">覆盖文件</option>
          <option value="append">追加到文件末尾</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">内容来源</label>
        <select
          value={data.contentSource}
          onChange={(e) => updateNodeData(node.id, { contentSource: e.target.value as WriteFileNodeData['contentSource'] })}
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
          <option value="input">来自上游节点（输入端口）</option>
          <option value="direct">直接输入内容</option>
        </select>
      </div>

      {data.contentSource === 'direct' && (
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">
            文件内容
            <span className="text-zinc-500 ml-1">(支持 {`{{变量}}`})</span>
          </label>
          <textarea
            value={data.directContent}
            onChange={(e) => updateNodeData(node.id, { directContent: e.target.value })}
            rows={4}
            placeholder="输入要写入的内容..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all resize-none"
          />
        </div>
      )}

      <div className="bg-white/5 rounded-lg p-3 text-xs text-zinc-400 border border-white/5">
        <div className="font-medium text-zinc-300 mb-1">说明：</div>
        <div>将数据写入到工作区中的文件。可用于保存处理结果、生成报告等。</div>
      </div>
    </div>
  )
}
