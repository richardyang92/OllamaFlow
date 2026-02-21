import { useState, useEffect } from 'react'
import type { WorkflowNode, ReactAgentNodeData, AvailableToolId } from '@/types/node'
import { AVAILABLE_TOOLS } from '@/types/node'
import { cn } from '@/lib/utils'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<ReactAgentNodeData>) => void
}

interface ModelInfo {
  name: string
}

export default function ReactAgentProperties({ node, updateNodeData }: Props) {
  const data = node.data as ReactAgentNodeData
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

  // Toggle tool selection
  const toggleTool = (toolId: AvailableToolId) => {
    const currentTools = data.enabledTools || []
    if (currentTools.includes(toolId)) {
      updateNodeData(node.id, {
        enabledTools: currentTools.filter((id) => id !== toolId),
      })
    } else {
      updateNodeData(node.id, {
        enabledTools: [...currentTools, toolId],
      })
    }
  }

  const enabledTools = data.enabledTools || []

  return (
    <div className="space-y-4">
      {/* Model Selection */}
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

      {/* System Prompt */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">系统提示词</label>
        <textarea
          value={data.systemPrompt}
          onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all resize-none"
          placeholder="设置 AI 智能体的角色和行为..."
        />
      </div>

      {/* User Message */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          用户消息
          <span className="text-zinc-500 ml-1">(支持 {`{{变量}}`})</span>
        </label>
        <textarea
          value={data.userMessage}
          onChange={(e) => updateNodeData(node.id, { userMessage: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all resize-none"
          placeholder="输入要解决的问题..."
        />
      </div>

      {/* Temperature */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">温度: {data.temperature}</label>
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

      {/* Max Iterations */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">最大迭代次数</label>
        <input
          type="number"
          min="1"
          max="50"
          value={data.maxIterations}
          onChange={(e) =>
            updateNodeData(node.id, { maxIterations: parseInt(e.target.value) || 10 })
          }
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
        />
        <p className="text-xs text-zinc-500 mt-1">防止无限循环的安全限制</p>
      </div>

      {/* Tools Selection - Checkbox style */}
      <div className="border-t border-white/10 pt-4">
        <label className="block text-xs font-medium text-zinc-400 mb-3">
          可用工具 ({AVAILABLE_TOOLS.filter((t) => t.builtIn || enabledTools.includes(t.id)).length} 个已启用)
        </label>
        <div className="space-y-2">
          {AVAILABLE_TOOLS.map((tool) => {
            const isEnabled = tool.builtIn || enabledTools.includes(tool.id)
            return (
              <label
                key={tool.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all',
                  'border',
                  isEnabled
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                )}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  disabled={tool.builtIn}
                  onChange={() => !tool.builtIn && toggleTool(tool.id)}
                  className="mt-0.5 rounded border-white/20 bg-white/5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">{tool.label}</span>
                    {tool.builtIn && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                        内置
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{tool.description}</p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {/* Stream Toggle */}
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

      {/* Output Info */}
      <div className="bg-white/5 rounded-lg p-3 text-xs text-zinc-400 border border-white/5">
        <div className="font-medium text-zinc-300 mb-2">输出说明：</div>
        <div className="space-y-1">
          <div>
            <span className="text-purple-400">最终回答</span>: 智能体的最终答案（唯一输出端口）
          </div>
          <div className="text-zinc-500 mt-2">
            中间步骤（思考、行动、观察）将在节点中实时展示
          </div>
        </div>
      </div>
    </div>
  )
}
