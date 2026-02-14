import type { WorkflowNode, OutputNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<OutputNodeData>) => void
}

export default function OutputProperties({ node, updateNodeData }: Props) {
  const data = node.data as OutputNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Output Type</label>
        <select
          value={data.outputType}
          onChange={(e) => updateNodeData(node.id, { outputType: e.target.value as OutputNodeData['outputType'] })}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="display">Display in panel</option>
          <option value="copy">Copy to clipboard</option>
          <option value="download">Download as file</option>
        </select>
      </div>

      <div className="bg-gray-700 rounded p-2 text-xs text-gray-400">
        <div className="font-medium text-gray-300 mb-1">Description:</div>
        {data.outputType === 'display' && (
          <div>Show the output in the execution panel</div>
        )}
        {data.outputType === 'copy' && (
          <div>Copy the output to system clipboard</div>
        )}
        {data.outputType === 'download' && (
          <div>Download the output as a text file</div>
        )}
      </div>
    </div>
  )
}
