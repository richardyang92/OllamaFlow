import type { WorkflowNode, IfNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<IfNodeData>) => void
}

export default function IfProperties({ node, updateNodeData }: Props) {
  const data = node.data as IfNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Condition Expression
        </label>
        <textarea
          value={data.expression}
          onChange={(e) => updateNodeData(node.id, { expression: e.target.value })}
          rows={3}
          placeholder="{{input}} == true"
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          Use {`{{variable}}`} to reference values. Example: {`{{score}} > 10`}
        </p>
      </div>

      <div className="bg-gray-700 rounded p-2 text-xs text-gray-400">
        <div className="font-medium text-gray-300 mb-1">Supported operators:</div>
        <div className="space-y-0.5">
          <div>Comparison: ==, !=, {'<'}, {'>'}, {'<='}, {'>='}</div>
          <div>Logic: &&, ||, !</div>
          <div>String: includes, startsWith, endsWith</div>
        </div>
      </div>
    </div>
  )
}
