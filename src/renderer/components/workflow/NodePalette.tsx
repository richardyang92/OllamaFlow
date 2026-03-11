import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { nodeTemplates, NodeTemplate } from '@/types/node'
import { getNodeIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

const categories = [
  { id: 'Input', label: '输入', color: 'bg-cyan-600' },
  { id: 'AI', label: 'AI', color: 'bg-purple-600' },
  { id: 'Logic', label: '逻辑', color: 'bg-blue-600' },
  { id: 'Data', label: '数据', color: 'bg-yellow-600' },
  { id: 'File', label: '文件', color: 'bg-orange-600' },
  { id: 'System', label: '系统', color: 'bg-red-600' },
  { id: 'Output', label: '输出', color: 'bg-teal-600' },
]

interface NodePaletteProps {
  onClose?: () => void
  isDrawer?: boolean
}

export default function NodePalette({ onClose, isDrawer = false }: NodePaletteProps) {
  const handleDragStart = (event: React.DragEvent, template: NodeTemplate) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(template))
    event.dataTransfer.effectAllowed = 'move'
  }

  const groupedTemplates = categories.map((category) => ({
    ...category,
    templates: nodeTemplates.filter((t) => t.category === category.id),
  }))

  if (isDrawer) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3">
          <p className="text-xs text-[var(--color-text-muted)]">拖拽节点到画布</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-4">
          {groupedTemplates.map(
            (category) =>
              category.templates.length > 0 && (
                <div key={category.id}>
                  <div className="flex items-center justify-center gap-2 mb-3 px-2">
                    <span className="text-sm font-medium text-[var(--color-text-muted)] text-center">
                      {category.label}
                    </span>
                    <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
                  </div>

                  <div className="space-y-1.5">
                    {category.templates.map((template) => (
                      <motion.div
                        key={template.type}
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, template)}
                          className={cn(
                            'p-3 rounded-lg cursor-grab active:cursor-grabbing',
                            'bg-[var(--color-bg-input)]',
                            'border border-[var(--color-border-subtle)]',
                            'hover:border-[var(--color-border)]',
                            'hover:bg-[var(--color-bg-hover)]',
                            'transition-all duration-200',
                            'group'
                          )}
                        >
                        <div className="flex items-center gap-2">
                            {getNodeIcon(template.icon, 'w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity')}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[var(--color-text)] group-hover:text-white transition-colors truncate">
                                {template.label}
                              </div>
                              <div className="text-xs text-[var(--color-text-muted)] truncate">{template.description}</div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="my-4 ml-4 mr-0 w-64 glass-panel rounded-glass-lg flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] rounded-t-glass-lg">
        <div className="flex-1">
          <h2 className="text-sm font-medium text-[var(--color-text)]">节点面板</h2>
          <p className="text-[10px] text-[var(--color-text-muted)]">拖拽节点到画布</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-input)] transition-all"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {groupedTemplates.map(
          (category) =>
            category.templates.length > 0 && (
              <div key={category.id}>
                <div className="flex items-center justify-center gap-2 mb-3 px-2">
                  <span className="text-sm font-medium text-[var(--color-text-muted)] text-center">
                    {category.label}
                  </span>
                  <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
                </div>

                <div className="space-y-1.5">
                  {category.templates.map((template) => (
                    <motion.div
                      key={template.type}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, template)}
                        className={cn(
                          'p-3 rounded-lg cursor-grab active:cursor-grabbing',
                          'bg-[var(--color-bg-input)]',
                          'border border-[var(--color-border-subtle)]',
                          'hover:border-[var(--color-border)]',
                          'hover:bg-[var(--color-bg-hover)]',
                          'transition-all duration-200',
                          'group'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {getNodeIcon(template.icon, 'w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity')}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--color-text)] group-hover:text-white transition-colors truncate">
                              {template.label}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)] truncate">{template.description}</div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  )
}
