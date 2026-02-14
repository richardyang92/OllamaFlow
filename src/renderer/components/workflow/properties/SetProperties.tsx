import type { WorkflowNode, SetNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<SetNodeData>) => void
}

export default function SetProperties({ node, updateNodeData }: Props) {
  const data = node.data as SetNodeData

  return (
    <div className="space-y-4">
      {/* Variable Name */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Variable Name</label>
        <input
          type="text"
          value={data.variableName}
          onChange={(e) => updateNodeData(node.id, { variableName: e.target.value })}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Variable Value */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Value
          <span className="text-gray-500 ml-1">(supports {`{{variables}}`})</span>
        </label>
        <textarea
          value={data.variableValue}
          onChange={(e) => updateNodeData(node.id, { variableValue: e.target.value })}
          rows={4}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {/* Use Expression */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="useExpression"
          checked={data.useExpression}
          onChange={(e) => updateNodeData(node.id, { useExpression: e.target.checked })}
          className="rounded border-gray-600"
        />
        <label htmlFor="useExpression" className="text-sm">
          Evaluate as JavaScript expression
        </label>
      </div>
    </div>
  )
}
