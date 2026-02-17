import { useState, useEffect } from 'react'
import type { WorkflowNode, OllamaChatNodeData } from '@/types/node'
import { cn } from '@/lib/utils'

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
      console.error('加载模型失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 模型选择 */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">模型</label>
        <select
          value={data.model}
          onChange={(e) => updateNodeData(node.id, { model: e.target.value })}
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-white/5',
            'border border-white/10',
            'text-white text-sm',
            'focus:outline-none focus:border-white/20 focus:bg-white/8',
            'transition-all duration-200',
            'select-sci-fi'
          )}
        >
          {isLoading ? (
            <option>加载中...</option>
          ) : models.length === 0 ? (
            <option>未找到模型</option>
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
          className="btn-sci-fi btn-ghost btn-sm mt-2 w-full"
        >
          🔄 刷新模型列表
        </button>
      </div>

      {/* 系统提示词 */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">系统提示词</label>
        <textarea
          value={data.systemPrompt}
          onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all resize-none"
          placeholder="设置 AI 的角色和行为..."
        />
      </div>

      {/* 用户消息 */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          用户消息
          <span className="text-zinc-500 ml-1">(支持 {`{{变量}}`})</span>
        </label>
        <textarea
          value={data.userMessage}
          onChange={(e) => updateNodeData(node.id, { userMessage: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all resize-none"
          placeholder="输入要发送给 AI 的消息..."
        />
      </div>

      {/* 温度 */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          温度: {data.temperature}
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
        <p className="text-xs text-zinc-500 mt-1">控制输出的随机性，值越高越随机</p>
      </div>

      {/* Top P */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">Top P: {data.topP}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={data.topP}
          onChange={(e) => updateNodeData(node.id, { topP: parseFloat(e.target.value) })}
          className="w-full"
        />
        <p className="text-xs text-zinc-500 mt-1">控制词汇的多样性</p>
      </div>

      {/* 最大 Token 数 */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">最大 Token 数</label>
        <input
          type="number"
          min="1"
          max="32768"
          value={data.maxTokens}
          onChange={(e) => updateNodeData(node.id, { maxTokens: parseInt(e.target.value) })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
        />
        <p className="text-xs text-zinc-500 mt-1">限制生成的最大长度</p>
      </div>

      {/* 流式输出 */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="stream"
          checked={data.stream}
          onChange={(e) => updateNodeData(node.id, { stream: e.target.checked })}
          className="rounded border-white/20 bg-white/5"
        />
        <label htmlFor="stream" className="text-sm text-zinc-300">
          启用流式输出
        </label>
      </div>
    </div>
  )
}
