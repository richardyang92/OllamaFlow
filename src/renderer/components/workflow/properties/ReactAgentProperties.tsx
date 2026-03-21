import { useEffect } from 'react'
import type { WorkflowNode, ReactAgentNodeData, AvailableToolId } from '@/types/node'
import { AVAILABLE_TOOLS } from '@/types/node'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings-store'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<ReactAgentNodeData>) => void
}

export default function ReactAgentProperties({ node, updateNodeData }: Props) {
  const data = node.data as ReactAgentNodeData

  // Get global AI config
  const { isGlobalAIEnabled, globalAIConfig, availableModels, isLoadingModels, fetchModels } = useSettingsStore()

  // Use global models if available
  const effectiveModels = isGlobalAIEnabled ? availableModels : []
  const effectiveLoading = isGlobalAIEnabled ? isLoadingModels : false

  useEffect(() => {
    // If global config is enabled, fetch global models
    if (isGlobalAIEnabled) {
      fetchModels()
    }
  }, [isGlobalAIEnabled, fetchModels])

  const handleRefreshModels = () => {
    if (isGlobalAIEnabled) {
      fetchModels()
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
      {/* 全局配置提示 */}
      {isGlobalAIEnabled && (
        <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-400">
            使用全局配置: {globalAIConfig?.name || '未命名'}
          </p>
        </div>
      )}

      {/* Model Selection */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          模型
        </label>
        <select
          value={data.model}
          onChange={(e) => updateNodeData(node.id, { model: e.target.value })}
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-[var(--color-bg-input)]',
            'border border-[var(--color-border-subtle)]',
            'text-[var(--color-text)] text-sm',
            'focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)]',
            'transition-all duration-200'
          )}
        >
          {effectiveLoading ? (
            <option>加载中...</option>
          ) : effectiveModels.length === 0 ? (
            <option>未找到模型</option>
          ) : (
            effectiveModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name || model.id}
              </option>
            ))
          )}
        </select>
        <button
          onClick={handleRefreshModels}
          disabled={effectiveLoading}
          className="btn-sci-fi btn-ghost btn-sm mt-2 w-full"
        >
          刷新模型列表
        </button>
      </div>

      {/* 精度提示 */}
      {!isGlobalAIEnabled && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-400">
            ⚠️ 请先在设置中配置全局 AI
          </p>
        </div>
      )}

      {/* System Prompt */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">系统提示词</label>
        <textarea
          value={data.systemPrompt}
          onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all resize-none"
          placeholder="设置 AI 智能体的角色和行为..."
        />
      </div>

      {/* User Message */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          用户消息
          <span className="text-[var(--color-text-muted)] ml-1">(支持 {"{{变量}}"})</span>
        </label>
        <textarea
          value={data.userMessage}
          onChange={(e) => updateNodeData(node.id, { userMessage: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all resize-none"
          placeholder="输入要解决的问题..."
        />
      </div>

      {/* Temperature */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">温度: {data.temperature}</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={data.temperature}
          onChange={(e) => updateNodeData(node.id, { temperature: parseFloat(e.target.value) })}
          className="w-full"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">控制输出的随机性，值越高越随机</p>
      </div>

      {/* Max Iterations */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">最大思考轮次</label>
        <input
          type="number"
          min="1"
          max="50"
          value={data.maxIterations}
          onChange={(e) =>
            updateNodeData(node.id, { maxIterations: parseInt(e.target.value) || 10 })
          }
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">防止无限循环的安全限制</p>
      </div>

      {/* Tools Selection - Checkbox style */}
      <div className="border-t border-[var(--color-border-subtle)] pt-4">
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-3">
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
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-[var(--color-bg-input)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)]'
                )}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  disabled={tool.builtIn}
                  onChange={() => !tool.builtIn && toggleTool(tool.id)}
                  className="mt-0.5 rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-input)]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">{tool.label}</span>
                    {tool.builtIn && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                        内置
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{tool.description}</p>
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
          className="rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-input)]"
        />
        <label htmlFor="stream" className="text-sm text-[var(--color-text)]">
          启用流式输出
        </label>
      </div>

      {/* Enable User Input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enableUserInput"
            checked={data.enableUserInput || false}
            onChange={(e) => updateNodeData(node.id, { enableUserInput: e.target.checked })}
            className="rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-input)]"
          />
          <label htmlFor="enableUserInput" className="text-sm text-[var(--color-text)]">
            启用用户交互
          </label>
        </div>
        {data.enableUserInput && (
          <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-400">
              智能体可以在需要时请求用户输入。
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              在系统提示词中指导 AI 使用 "WAIT_FOR_INPUT: 问题内容" 格式来请求用户输入。
            </p>
          </div>
        )}
      </div>

      {/* Output Info */}
      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-2">输出说明：</div>
        <div className="space-y-1">
          <div>
            <span className="text-blue-400">最终回答</span>: 智能体的最终答案（唯一输出端口）
          </div>
          <div className="text-[var(--color-text-muted)] mt-2">
            中间步骤（思考、行动、观察）将在节点中实时展示
          </div>
        </div>
      </div>
    </div>
  )
}
