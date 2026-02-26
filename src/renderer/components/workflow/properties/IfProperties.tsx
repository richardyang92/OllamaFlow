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
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          条件表达式
        </label>
        <textarea
          value={data.expression}
          onChange={(e) => updateNodeData(node.id, { expression: e.target.value })}
          rows={3}
          placeholder="{{input}} == true"
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all resize-none font-mono"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          使用 {`{{变量名}}`} 引用变量。例如: {`{{分数}} > 60`}
        </p>
      </div>

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-2">支持的运算符：</div>
        <div className="space-y-1">
          <div><span className="text-[var(--color-text)]">比较：</span> ==, !=, {'<'}, {'>'}, {'<='}, {'>='}</div>
          <div><span className="text-[var(--color-text)]">逻辑：</span> && (与), || (或), ! (非)</div>
          <div><span className="text-[var(--color-text)]">字符串：</span> includes, startsWith, endsWith</div>
        </div>
        <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
          <div className="font-medium text-[var(--color-text)] mb-1">连接说明：</div>
          <div>• <span className="text-green-400">真端口</span>: 条件为真时执行</div>
          <div>• <span className="text-red-400">假端口</span>: 条件为假时执行</div>
        </div>
      </div>
    </div>
  )
}
