import type { WorkflowNode, ExecuteCommandNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<ExecuteCommandNodeData>) => void
}

export default function ExecuteCommandProperties({ node, updateNodeData }: Props) {
  const data = node.data as ExecuteCommandNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Command
          <span className="text-gray-500 ml-1">(supports {`{{variables}}`})</span>
        </label>
        <textarea
          value={data.command}
          onChange={(e) => updateNodeData(node.id, { command: e.target.value })}
          rows={3}
          placeholder="echo 'Hello World'"
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Working Directory
          <span className="text-gray-500 ml-1">(optional, relative to workspace)</span>
        </label>
        <input
          type="text"
          value={data.cwd}
          onChange={(e) => updateNodeData(node.id, { cwd: e.target.value })}
          placeholder="./scripts"
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm font-mono focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Timeout (seconds)
        </label>
        <input
          type="number"
          min="1"
          max="600"
          value={data.timeout / 1000}
          onChange={(e) => updateNodeData(node.id, { timeout: parseInt(e.target.value) * 1000 })}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="continueOnError"
          checked={data.continueOnError}
          onChange={(e) => updateNodeData(node.id, { continueOnError: e.target.checked })}
          className="rounded border-gray-600"
        />
        <label htmlFor="continueOnError" className="text-sm">
          Continue on error
        </label>
      </div>

      <div className="bg-gray-700 rounded p-2 text-xs text-gray-400">
        <div className="font-medium text-gray-300 mb-1">Outputs:</div>
        <div className="space-y-0.5">
          <div>• stdout: Standard output</div>
          <div>• stderr: Standard error</div>
          <div>• exitCode: Exit code (0 = success)</div>
        </div>
      </div>
    </div>
  )
}
