import type { WorkflowNode, IfNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<IfNodeData>) => void
}

export default function IfProperties({ node, updateNodeData }: Props) {
  const data = node.data as IfNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          条件表达式
        </label>
        <textarea
          value={data.expression}
          onChange={(e) => updateNodeData(node.id, { expression: e.target.value })}
          rows={3}
          placeholder="{{input}} == true"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all resize-none font-mono"
        />
        <p className="text-xs text-zinc-500 mt-1">
          使用 {`{{变量名}}`} 引用变量。例如: {`{{分数}} > 60`}
        </p>
      </div>

      <div className="bg-white/5 rounded-lg p-3 text-xs text-zinc-400 border border-white/5">
        <div className="font-medium text-zinc-300 mb-2">支持的运算符：</div>
        <div className="space-y-1">
          <div><span className="text-zinc-300">比较：</span> ==, !=, {'<'}, {'>'}, {'<='}, {'>='}</div>
          <div><span className="text-zinc-300">逻辑：</span> && (与), || (或), ! (非)</div>
          <div><span className="text-zinc-300">字符串：</span> includes, startsWith, endsWith</div>
        </div>
        <div className="mt-2 pt-2 border-t border-white/5">
          <div className="font-medium text-zinc-300 mb-1">连接说明：</div>
          <div>• <span className="text-green-400">真端口</span>: 条件为真时执行</div>
          <div>• <span className="text-red-400">假端口</span>: 条件为假时执行</div>
        </div>
      </div>
    </div>
  )
}
