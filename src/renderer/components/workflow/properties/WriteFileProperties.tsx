import type { WorkflowNode, WriteFileNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<WriteFileNodeData>) => void
}

export default function WriteFileProperties({ node, updateNodeData }: Props) {
  const data = node.data as WriteFileNodeData

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
          placeholder="data/output.txt"
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Write Mode</label>
        <select
          value={data.writeMode}
          onChange={(e) => updateNodeData(node.id, { writeMode: e.target.value as WriteFileNodeData['writeMode'] })}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="overwrite">Overwrite</option>
          <option value="append">Append</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Content Source</label>
        <select
          value={data.contentSource}
          onChange={(e) => updateNodeData(node.id, { contentSource: e.target.value as WriteFileNodeData['contentSource'] })}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="input">From upstream (input port)</option>
          <option value="direct">Direct input</option>
        </select>
      </div>

      {data.contentSource === 'direct' && (
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Content
            <span className="text-gray-500 ml-1">(supports {`{{variables}}`})</span>
          </label>
          <textarea
            value={data.directContent}
            onChange={(e) => updateNodeData(node.id, { directContent: e.target.value })}
            rows={4}
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
      )}
    </div>
  )
}
