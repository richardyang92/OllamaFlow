import { DragEvent } from 'react'
import { nodeTemplates, NodeTemplate } from '@/types/node'

const categories = [
  { id: 'Triggers', label: '▶ Triggers', color: 'bg-green-600' },
  { id: 'Input', label: '📥 Input', color: 'bg-cyan-600' },
  { id: 'AI', label: '🤖 AI', color: 'bg-purple-600' },
  { id: 'Logic', label: '🔀 Logic', color: 'bg-blue-600' },
  { id: 'Data', label: '✏️ Data', color: 'bg-yellow-600' },
  { id: 'File', label: '📄 File', color: 'bg-orange-600' },
  { id: 'System', label: '⚡ System', color: 'bg-red-600' },
  { id: 'Output', label: '📤 Output', color: 'bg-teal-600' },
]

export default function NodePalette() {
  const onDragStart = (event: DragEvent<HTMLDivElement>, template: NodeTemplate) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(template))
    event.dataTransfer.effectAllowed = 'move'
  }

  const groupedTemplates = categories.map((category) => ({
    ...category,
    templates: nodeTemplates.filter((t) => t.category === category.id),
  }))

  return (
    <div className="w-56 bg-gray-800 border-r border-gray-700 overflow-y-auto">
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-400">Nodes</h2>
      </div>
      <div className="p-2 space-y-4">
        {groupedTemplates.map(
          (category) =>
            category.templates.length > 0 && (
              <div key={category.id}>
                <div className={`text-xs font-medium px-2 py-1 rounded ${category.color} mb-2`}>
                  {category.label}
                </div>
                <div className="space-y-1">
                  {category.templates.map((template) => (
                    <div
                      key={template.type}
                      draggable
                      onDragStart={(e) => onDragStart(e, template)}
                      className="flex items-center gap-2 p-2 rounded cursor-grab hover:bg-gray-700 active:cursor-grabbing transition-colors"
                    >
                      <span className="text-lg">{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{template.label}</div>
                        <div className="text-xs text-gray-500 truncate">{template.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  )
}
