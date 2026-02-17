import { motion } from 'framer-motion'
import { nodeTemplates, NodeTemplate } from '@/types/node'
import { cn } from '@/lib/utils'

const categories = [
  { id: 'Input', label: '📥 输入', color: 'bg-cyan-600' },
  { id: 'AI', label: '🤖 AI', color: 'bg-purple-600' },
  { id: 'Logic', label: '🔀 逻辑', color: 'bg-blue-600' },
  { id: 'Data', label: '✏️ 数据', color: 'bg-yellow-600' },
  { id: 'File', label: '📄 文件', color: 'bg-orange-600' },
  { id: 'System', label: '⚡ 系统', color: 'bg-red-600' },
  { id: 'Output', label: '📤 输出', color: 'bg-teal-600' },
]

interface NodePaletteProps {
  onClose?: () => void
}

export default function NodePalette({ onClose }: NodePaletteProps) {
  const handleDragStart = (event: React.DragEvent, template: NodeTemplate) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(template))
    event.dataTransfer.effectAllowed = 'move'
  }

  const groupedTemplates = categories.map((category) => ({
    ...category,
    templates: nodeTemplates.filter((t) => t.category === category.id),
  }))

  return (
    <div className="my-4 ml-4 mr-0 w-64 bg-panel-bg backdrop-blur-md rounded-xl border border-white/10 shadow-2xl flex flex-col">
      {/* Header with compact styling and collapse button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 rounded-t-xl">
        <div className="flex-1">
          <h2 className="text-sm font-medium text-zinc-100">节点面板</h2>
          <p className="text-[10px] text-zinc-400">拖拽节点到画布</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xs transition-colors ml-2"
            title="收起"
          >
            ▼
          </button>
        )}
      </div>

      {/* Node list with consistent spacing */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {groupedTemplates.map(
          (category) =>
            category.templates.length > 0 && (
              <div key={category.id}>
                {/* Category header with unified alignment */}
                <div className="flex items-center justify-center gap-2 mb-3 px-2">
                  <span className="text-sm font-medium text-zinc-400 text-center">
                    {category.label}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                </div>

                {/* Node cards */}
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
                          'bg-card-bg',
                          'backdrop-blur-sm',
                          'border border-white/5',
                          'hover:border-white/15',
                          'hover:bg-white/[0.03]',
                          'transition-all duration-200',
                          'group'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg opacity-80 group-hover:opacity-100 transition-opacity">
                            {template.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors truncate">
                              {template.label}
                            </div>
                            <div className="text-xs text-zinc-500 truncate">{template.description}</div>
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
