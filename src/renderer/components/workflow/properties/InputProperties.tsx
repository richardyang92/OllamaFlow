import type { WorkflowNode, InputNodeData } from '@/types/node'
import { cn } from '@/lib/utils'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<InputNodeData>) => void
}

export default function InputProperties({ node, updateNodeData }: Props) {
  const data = node.data as InputNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">输入类型</label>
        <select
          value={data.inputType}
          onChange={(e) => updateNodeData(node.id, { inputType: e.target.value as InputNodeData['inputType'] })}
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-[var(--color-bg-input)]',
            'border border-[var(--color-border-subtle)]',
            'text-[var(--color-text)] text-sm',
            'focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)]',
            'transition-all duration-200'
          )}
        >
          <option value="string">文本</option>
          <option value="number">数字</option>
          <option value="boolean">布尔值</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">提示信息</label>
        <input
          type="text"
          value={data.prompt}
          onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
          placeholder="请输入提示信息..."
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-[var(--color-bg-input)]',
            'border border-[var(--color-border-subtle)]',
            'text-[var(--color-text)] text-sm',
            'placeholder:text-[var(--color-text-muted)]',
            'focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)]',
            'transition-all duration-200'
          )}
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">向用户请求输入时显示的消息</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">默认值</label>
        {data.inputType === 'boolean' ? (
          <select
            value={data.defaultValue}
            onChange={(e) => updateNodeData(node.id, { defaultValue: e.target.value })}
            className={cn(
              'w-full px-3 py-2 rounded-lg',
              'bg-[var(--color-bg-input)]',
              'border border-[var(--color-border-subtle)]',
              'text-[var(--color-text)] text-sm',
              'focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)]',
              'transition-all duration-200'
            )}
          >
            <option value="true">真 (True)</option>
            <option value="false">假 (False)</option>
          </select>
        ) : (
          <input
            type={data.inputType === 'number' ? 'number' : 'text'}
            value={data.defaultValue}
            onChange={(e) => updateNodeData(node.id, { defaultValue: e.target.value })}
            placeholder="请输入默认值..."
            className={cn(
              'w-full px-3 py-2 rounded-lg',
              'bg-[var(--color-bg-input)]',
              'border border-[var(--color-border-subtle)]',
              'text-[var(--color-text)] text-sm',
              'placeholder:text-[var(--color-text-muted)]',
              'focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)]',
              'transition-all duration-200'
            )}
          />
        )}
        <p className="text-xs text-[var(--color-text-muted)] mt-1">如果用户未提供输入则使用此值</p>
      </div>

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-1">说明：</div>
        <div>在执行 SubAgent 时提示用户输入。该值随后将传递给连接的节点。</div>
      </div>
    </div>
  )
}
