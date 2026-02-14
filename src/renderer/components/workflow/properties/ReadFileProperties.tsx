import type { WorkflowNode, ReadFileNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<ReadFileNodeData>) => void
}

export default function ReadFileProperties({ node, updateNodeData }: Props) {
  const data = node.data as ReadFileNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          File Path
          <span className="text-gray-500 ml-1">(relative to workspace)</span>
        </label>
        <input
          type="text"
          value={data.filePath}
          onChange={(e) => updateNodeData(node.id, { filePath: e.target.value })}
          placeholder="data/input.txt"
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Encoding</label>
        <select
          value={data.encoding}
          onChange={(e) => updateNodeData(node.id, { encoding: e.target.value })}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="utf-8">UTF-8</option>
          <option value="ascii">ASCII</option>
          <option value="base64">Base64</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="errorIfNotFound"
          checked={data.errorIfNotFound}
          onChange={(e) => updateNodeData(node.id, { errorIfNotFound: e.target.checked })}
          className="rounded border-gray-600"
        />
        <label htmlFor="errorIfNotFound" className="text-sm">
          Error if file not found
        </label>
      </div>
    </div>
  )
}
