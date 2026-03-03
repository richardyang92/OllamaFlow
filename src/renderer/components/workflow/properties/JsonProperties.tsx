import type { WorkflowNode, JsonNodeData, JsonNodeMode } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<JsonNodeData>) => void
}

const modeOptions: { value: JsonNodeMode; label: string; description: string }[] = [
  { value: 'parse', label: '解析', description: '将 JSON 字符串转为对象' },
  { value: 'stringify', label: '字符串化', description: '将对象转为 JSON 字符串' },
  { value: 'extract', label: '提取', description: '使用 JSONPath 提取字段' },
  { value: 'merge', label: '合并', description: '合并多个 JSON 对象' },
]

export default function JsonProperties({ node, updateNodeData }: Props) {
  const data = node.data as JsonNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          处理模式
        </label>
        <select
          value={data.mode}
          onChange={(e) => updateNodeData(node.id, { mode: e.target.value as JsonNodeMode })}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)]"
        >
          {modeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.description}
            </option>
          ))}
        </select>
      </div>

      {data.mode === 'extract' && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            JSONPath 表达式
          </label>
          <input
            type="text"
            value={data.jsonPath}
            onChange={(e) => updateNodeData(node.id, { jsonPath: e.target.value })}
            placeholder="$.data.items[0].name"
            className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] font-mono"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            使用点语法访问嵌套字段，如：<br />
            <code className="text-[var(--color-text)]">$.key</code> 或 <code className="text-[var(--color-text)]">$.items[0]</code>
          </p>
        </div>
      )}

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-2">模式说明：</div>
        <div className="space-y-2">
          <div>
            <span className="text-[var(--color-text)]">解析：</span>
            输入 JSON 字符串，输出解析后的对象
          </div>
          <div>
            <span className="text-[var(--color-text)]">字符串化：</span>
            输入对象，输出 JSON 字符串
          </div>
          <div>
            <span className="text-[var(--color-text)]">提取：</span>
            从对象中提取指定路径的值
          </div>
          <div>
            <span className="text-[var(--color-text)]">合并：</span>
            合并所有输入对象（后面的覆盖前面的）
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
          <div className="text-[var(--color-text-muted)]">输出变量: <code className="text-[var(--color-text)]">output</code></div>
        </div>
      </div>
    </div>
  )
}
