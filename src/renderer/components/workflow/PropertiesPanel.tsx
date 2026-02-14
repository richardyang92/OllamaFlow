import { useWorkflowStore } from '@/store/workflow-store'
import InputProperties from './properties/InputProperties'
import OllamaChatProperties from './properties/OllamaChatProperties'
import SetProperties from './properties/SetProperties'
import IfProperties from './properties/IfProperties'
import OutputProperties from './properties/OutputProperties'
import ReadFileProperties from './properties/ReadFileProperties'
import WriteFileProperties from './properties/WriteFileProperties'
import ExecuteCommandProperties from './properties/ExecuteCommandProperties'

export default function PropertiesPanel({ onClose }: { onClose: () => void }) {
  const { selectedNodeId, getSelectedNode, updateNodeData, deleteNode, selectNode } = useWorkflowStore()
  const selectedNode = getSelectedNode()

  if (!selectedNode) {
    return (
      <div className="w-72 bg-gray-800 border-l border-gray-700 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Select a node to edit properties</p>
      </div>
    )
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this node?')) {
      deleteNode(selectedNodeId!)
      selectNode(null)
    }
  }

  const renderProperties = () => {
    switch (selectedNode.data.nodeType) {
      case 'input':
        return <InputProperties node={selectedNode} updateNodeData={updateNodeData} />
      case 'ollamaChat':
        return <OllamaChatProperties node={selectedNode} updateNodeData={updateNodeData} />
      case 'set':
        return <SetProperties node={selectedNode} updateNodeData={updateNodeData} />
      case 'if':
        return <IfProperties node={selectedNode} updateNodeData={updateNodeData} />
      case 'output':
        return <OutputProperties node={selectedNode} updateNodeData={updateNodeData} />
      case 'readFile':
        return <ReadFileProperties node={selectedNode} updateNodeData={updateNodeData} />
      case 'writeFile':
        return <WriteFileProperties node={selectedNode} updateNodeData={updateNodeData} />
      case 'executeCommand':
        return <ExecuteCommandProperties node={selectedNode} updateNodeData={updateNodeData} />
      case 'manualTrigger':
        return (
          <div className="text-gray-400 text-sm">
            Manual trigger has no additional properties.
          </div>
        )
      default:
        return (
          <div className="text-gray-400 text-sm">No properties available for this node type.</div>
        )
    }
  }

  return (
    <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold">Properties</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Node label */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-1">Label</label>
          <input
            type="text"
            value={selectedNode.data.label}
            onChange={(e) => updateNodeData(selectedNodeId!, { label: e.target.value })}
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Node-specific properties */}
        {renderProperties()}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={handleDelete}
          className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
        >
          🗑 Delete Node
        </button>
      </div>
    </div>
  )
}
