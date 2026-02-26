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
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          文件路径
          <span className="text-[var(--color-text-muted)] ml-1">(相对于工作区)</span>
        </label>
        <input
          type="text"
          value={data.filePath}
          onChange={(e) => updateNodeData(node.id, { filePath: e.target.value })}
          placeholder="data/output.txt"
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">写入模式</label>
        <select
          value={data.writeMode}
          onChange={(e) => updateNodeData(node.id, { writeMode: e.target.value as WriteFileNodeData['writeMode'] })}
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-[var(--color-bg-input)]',
            'border border-[var(--color-border-subtle)]',
            'text-[var(--color-text)] text-sm',
            'focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)]',
            'transition-all duration-200'
          )}
        >
          <option value="overwrite">覆盖文件</option>
          <option value="append">追加到文件末尾</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">内容来源</label>
        <select
          value={data.contentSource}
          onChange={(e) => updateNodeData(node.id, { contentSource: e.target.value as WriteFileNodeData['contentSource'] })}
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-[var(--color-bg-input)]',
            'border border-[var(--color-border-subtle)]',
            'text-[var(--color-text)] text-sm',
            'focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)]',
            'transition-all duration-200'
          )}
        >
          <option value="input">来自上游节点（输入端口）</option>
          <option value="direct">直接输入内容</option>
        </select>
      </div>

      {data.contentSource === 'direct' && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            文件内容
            <span className="text-[var(--color-text-muted)] ml-1">(支持 {`{{变量}}`})</span>
          </label>
          <textarea
            value={data.directContent}
            onChange={(e) => updateNodeData(node.id, { directContent: e.target.value })}
            rows={4}
            placeholder="输入要写入的内容..."
            className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all resize-none"
          />
        </div>
      )}

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-1">说明：</div>
        <div>将数据写入到工作区中的文件。可用于保存处理结果、生成报告等。</div>
      </div>
    </div>
  )
}
