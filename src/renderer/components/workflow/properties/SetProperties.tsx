import type { WorkflowNode, SetNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<SetNodeData>) => void
}

export default function SetProperties({ node, updateNodeData }: Props) {
  const data = node.data as SetNodeData

  return (
    <div className="space-y-4">
      {/* 变量名 */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">变量名</label>
        <input
          type="text"
          value={data.variableName}
          onChange={(e) => updateNodeData(node.id, { variableName: e.target.value })}
          placeholder="myVariable"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all font-mono"
        />
        <p className="text-xs text-zinc-500 mt-1">用于存储值的变量名称</p>
      </div>

      {/* 变量值 */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          变量值
          <span className="text-zinc-500 ml-1">(支持 {`{{变量}}`})</span>
        </label>
        <textarea
          value={data.variableValue}
          onChange={(e) => updateNodeData(node.id, { variableValue: e.target.value })}
          rows={4}
          placeholder="输入变量的值..."
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all resize-none"
        />
      </div>

      {/* 使用表达式 */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="useExpression"
          checked={data.useExpression}
          onChange={(e) => updateNodeData(node.id, { useExpression: e.target.checked })}
          className="rounded border-white/20 bg-white/5"
        />
        <label htmlFor="useExpression" className="text-sm text-zinc-300">
          作为 JavaScript 表达式求值
        </label>
      </div>
      <p className="text-xs text-zinc-500 ml-6">启用后将使用 eval() 计算表达式的值</p>

      <div className="bg-white/5 rounded-lg p-3 text-xs text-zinc-400 border border-white/5">
        <div className="font-medium text-zinc-300 mb-1">示例：</div>
        <div className="space-y-0.5">
          <div>• 变量名: <code className="text-zinc-300">userName</code></div>
          <div>• 变量值: <code className="text-zinc-300">{`{{input}}`}</code></div>
          <div>• 表达式: <code className="text-zinc-300">{`{{count}} + 1`}</code></div>
        </div>
      </div>
    </div>
  )
}
