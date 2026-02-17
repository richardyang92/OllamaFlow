import type { WorkflowNode, ReadFileNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<ReadFileNodeData>) => void
}

export default function ReadFileProperties({ node, updateNodeData }: Props) {
  const data = node.data as ReadFileNodeData

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
          placeholder="data/input.txt"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">编码格式</label>
        <select
          value={data.encoding}
          onChange={(e) => updateNodeData(node.id, { encoding: e.target.value })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
        >
          <option value="utf-8">UTF-8</option>
          <option value="ascii">ASCII</option>
          <option value="base64">Base64</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="errorIfNotFound"
          checked={data.errorIfNotFound}
          onChange={(e) => updateNodeData(node.id, { errorIfNotFound: e.target.checked })}
          className="rounded border-white/20 bg-white/5"
        />
        <label htmlFor="errorIfNotFound" className="text-sm text-zinc-300">
          文件不存在时报错
        </label>
      </div>

      <div className="bg-white/5 rounded-lg p-3 text-xs text-zinc-400 border border-white/5">
        <div className="font-medium text-zinc-300 mb-1">说明：</div>
        <div>从工作区读取文件内容，可通过输出端口传递给后续节点使用。</div>
      </div>
    </div>
  )
}
