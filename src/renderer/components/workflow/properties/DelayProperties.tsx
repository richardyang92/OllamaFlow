import type { WorkflowNode, DelayNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<DelayNodeData>) => void
}

export default function DelayProperties({ node, updateNodeData }: Props) {
  const data = node.data as DelayNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          延迟时间
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            value={data.delayMs}
            onChange={(e) => updateNodeData(node.id, { delayMs: parseInt(e.target.value) || 0 })}
            className="flex-1 px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)]"
          />
          <select
            value={data.delayMs < 1000 ? 'ms' : data.delayMs < 60000 ? 's' : 'min'}
            onChange={(e) => {
              const unit = e.target.value
              let newValue = data.delayMs
              if (unit === 'ms' && data.delayMs >= 1000) {
                newValue = data.delayMs
              } else if (unit === 's' && data.delayMs < 1000) {
                newValue = data.delayMs * 1000
              } else if (unit === 'min' && data.delayMs < 60000) {
                newValue = data.delayMs * 60
              }
              updateNodeData(node.id, { delayMs: newValue })
            }}
            className="px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)]"
          >
            <option value="ms">毫秒</option>
            <option value="s">秒</option>
            <option value="min">分钟</option>
          </select>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          当前设置: {data.delayMs} 毫秒 ({data.delayMs < 1000 ? `${data.delayMs}ms` : data.delayMs < 60000 ? `${(data.delayMs / 1000).toFixed(1)}s` : `${(data.delayMs / 60000).toFixed(1)}min`})
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="passthrough"
          checked={data.passthrough}
          onChange={(e) => updateNodeData(node.id, { passthrough: e.target.checked })}
          className="rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-input)]"
        />
        <label htmlFor="passthrough" className="text-sm text-[var(--color-text)]">
          透传输入数据到输出
        </label>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] -mt-2">
        启用后，输出将包含输入数据；禁用则只输出延迟信息
      </p>

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-2">输出变量：</div>
        <div className="space-y-1">
          {data.passthrough && (
            <div>• <code className="text-[var(--color-text)]">input</code>: 透传的输入数据</div>
          )}
          <div>• <code className="text-[var(--color-text)]">delayedMs</code>: 实际延迟时间（毫秒）</div>
        </div>
      </div>
    </div>
  )
}
