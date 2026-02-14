import { useState, useEffect } from 'react'
import type { WorkflowNode, OllamaChatNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<OllamaChatNodeData>) => void
}

interface ModelInfo {
  name: string
}

export default function OllamaChatProperties({ node, updateNodeData }: Props) {
  const data = node.data as OllamaChatNodeData
  const [models, setModels] = useState<ModelInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://127.0.0.1:11434/api/tags')
      if (response.ok) {
        const json = await response.json()
        setModels(json.models || [])
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Model Selection */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Model</label>
        <select
          value={data.model}
          onChange={(e) => updateNodeData(node.id, { model: e.target.value })}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        >
          {isLoading ? (
            <option>Loading...</option>
          ) : models.length === 0 ? (
            <option>No models found</option>
          ) : (
            models.map((model) => (
              <option key={model.name} value={model.name}>
                {model.name}
              </option>
            ))
          )}
        </select>
        <button
          onClick={loadModels}
          className="mt-1 text-xs text-blue-400 hover:text-blue-300"
        >
          Refresh models
        </button>
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">System Prompt</label>
        <textarea
          value={data.systemPrompt}
          onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })}
          rows={3}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {/* User Message */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          User Message
          <span className="text-gray-500 ml-1">(supports {`{{variables}}`})</span>
        </label>
        <textarea
          value={data.userMessage}
          onChange={(e) => updateNodeData(node.id, { userMessage: e.target.value })}
          rows={3}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {/* Temperature */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Temperature: {data.temperature}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={data.temperature}
          onChange={(e) => updateNodeData(node.id, { temperature: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Top P */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Top P: {data.topP}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={data.topP}
          onChange={(e) => updateNodeData(node.id, { topP: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Max Tokens */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Max Tokens</label>
        <input
          type="number"
          min="1"
          max="32768"
          value={data.maxTokens}
          onChange={(e) => updateNodeData(node.id, { maxTokens: parseInt(e.target.value) })}
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Stream */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="stream"
          checked={data.stream}
          onChange={(e) => updateNodeData(node.id, { stream: e.target.checked })}
          className="rounded border-gray-600"
        />
        <label htmlFor="stream" className="text-sm">
          Stream output
        </label>
      </div>
    </div>
  )
}
