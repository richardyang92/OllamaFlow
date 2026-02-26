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
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">变量名</label>
        <input
          type="text"
          value={data.variableName}
          onChange={(e) => updateNodeData(node.id, { variableName: e.target.value })}
          placeholder="myVariable"
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all font-mono"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">用于存储值的变量名称</p>
      </div>

      {/* 变量值 */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          变量值
          <span className="text-[var(--color-text-muted)] ml-1">(支持 {`{{变量}}`})</span>
        </label>
        <textarea
          value={data.variableValue}
          onChange={(e) => updateNodeData(node.id, { variableValue: e.target.value })}
          rows={4}
          placeholder="输入变量的值..."
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all resize-none"
        />
      </div>

      {/* 使用表达式 */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="useExpression"
          checked={data.useExpression}
          onChange={(e) => updateNodeData(node.id, { useExpression: e.target.checked })}
          className="rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-input)]"
        />
        <label htmlFor="useExpression" className="text-sm text-[var(--color-text)]">
          作为 JavaScript 表达式求值
        </label>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] ml-6">启用后将使用 eval() 计算表达式的值</p>

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-1">示例：</div>
        <div className="space-y-0.5">
          <div>• 变量名: <code className="text-[var(--color-text)]">userName</code></div>
          <div>• 变量值: <code className="text-[var(--color-text)]">{`{{input}}`}</code></div>
          <div>• 表达式: <code className="text-[var(--color-text)]">{`{{count}} + 1`}</code></div>
        </div>
      </div>
    </div>
  )
}
