import { useEffect } from 'react'
import type { WorkflowNode, PlanNodeData } from '@/types/node'
import { useSettingsStore } from '@/store/settings-store'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<PlanNodeData>) => void
}

export default function PlanProperties({ node, updateNodeData }: Props) {
  const data = node.data as PlanNodeData

  // Get global AI config
  const { isGlobalAIEnabled, globalAIConfig, availableModels, isLoadingModels, fetchModels } = useSettingsStore()

  // Use global models
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

  return (
    <div className="space-y-4">
      {/* 全局配置提示 */}
      {isGlobalAIEnabled && (
        <div className="px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="text-xs text-purple-400">
            使用全局配置: {globalAIConfig?.name || '未命名'}
          </p>
        </div>
      )}

      {/* Model Selection */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          模型
        </label>
        <div className="flex gap-2">
          <select
            value={data.model}
            onChange={(e) => updateNodeData(node.id, { model: e.target.value })}
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all duration-200"
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
            disabled={effectiveLoading || !isGlobalAIEnabled}
            className="px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] rounded-lg transition-all disabled:opacity-50"
          >
            {effectiveLoading ? '...' : '🔄'}
          </button>
        </div>
      </div>

      {/* 警告提示 */}
      {!isGlobalAIEnabled && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-400">
            请先在设置中配置全局 AI
          </p>
        </div>
      )}

      {/* System prompt */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">系统提示词</label>
        <textarea
          value={data.systemPrompt}
          onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all resize-none"
          placeholder="输入系统提示词..."
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          定义 AI 的角色和行为方式
        </p>
      </div>

      {/* Temperature */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
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
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          较低的值更确定，较高的值更随机
        </p>
      </div>

      {/* Max Tokens */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">最大令牌数</label>
        <input
          type="number"
          value={data.maxTokens}
          onChange={(e) => updateNodeData(node.id, { maxTokens: parseInt(e.target.value) || 4096 })}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          生成的最大令牌数量
        </p>
      </div>
    </div>
  )
}
