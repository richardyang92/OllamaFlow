import type { WorkflowNode, InputNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<InputNodeData>) => void
}

export default function InputProperties({ node, updateNodeData }: Props) {
  const data = node.data as InputNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Input Type</label>
        <select
          value={data.inputType}
          onChange={(e) => updateNodeData(node.id, { inputType: e.target.value as InputNodeData['inputType'] })}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="string">Text</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Prompt Message</label>
        <input
          type="text"
          value={data.prompt}
          onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
          placeholder="Enter prompt message..."
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">Message shown when requesting input</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Default Value</label>
        {data.inputType === 'boolean' ? (
          <select
            value={data.defaultValue}
            onChange={(e) => updateNodeData(node.id, { defaultValue: e.target.value })}
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        ) : (
          <input
            type={data.inputType === 'number' ? 'number' : 'text'}
            value={data.defaultValue}
            onChange={(e) => updateNodeData(node.id, { defaultValue: e.target.value })}
            placeholder="Enter default value..."
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
          />
        )}
        <p className="text-xs text-gray-500 mt-1">Value used if user doesn't provide input</p>
      </div>

      <div className="bg-gray-700 rounded p-2 text-xs text-gray-400">
        <div className="font-medium text-gray-300 mb-1">Description:</div>
        <div>Prompts the user for input during workflow execution. The value is then passed to connected nodes.</div>
      </div>
    </div>
  )
}
