import type { WorkflowNode, ImageNodeData } from '@/types/node'
import { cn } from '@/lib/utils'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<ImageNodeData>) => void
}

export default function ImageProperties({ node, updateNodeData }: Props) {
  const data = node.data as ImageNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">图片来源</label>
        <select
          value={data.sourceType || 'input'}
          onChange={(e) => updateNodeData(node.id, { sourceType: e.target.value as 'input' | 'variable' })}
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-[var(--color-bg-input)]',
            'border border-[var(--color-border-subtle)]',
            'text-[var(--color-text)] text-sm',
            'focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)]',
            'transition-all duration-200'
          )}
        >
          <option value="input">使用输入值</option>
          <option value="variable">使用变量</option>
        </select>
      </div>

      {data.sourceType === 'variable' && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">变量名</label>
          <input
            type="text"
            value={data.variableName || ''}
            onChange={(e) => updateNodeData(node.id, { variableName: e.target.value })}
            placeholder="输入变量名（如：myVar）"
            className={cn(
              'w-full px-3 py-2 rounded-lg',
              'bg-[var(--color-bg-input)]',
              'border border-[var(--color-border-subtle)]',
              'text-[var(--color-text)] text-sm',
              'focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)]',
              'transition-all duration-200',
              'placeholder:text-[var(--color-text-muted)]'
            )}
          />
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            使用"设置变量"节点设置的变量名
          </div>
        </div>
      )}

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-1">说明：</div>
        {data.sourceType === 'input' && (
          <div>显示从输入端口接收的图片URL</div>
        )}
        {data.sourceType === 'variable' && (
          <div>显示指定变量的值作为图片URL，变量由"设置变量"节点设置</div>
        )}
        <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
          <div>支持 HTTP/HTTPS URL 或项目内的本地文件路径</div>
        </div>
      </div>
    </div>
  )
}
