import { useEffect } from 'react'
import type { WorkflowNode, OllamaChatNodeData } from '@/types/node'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings-store'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<OllamaChatNodeData>) => void
}

export default function OllamaChatProperties({ node, updateNodeData }: Props) {
  const data = node.data as OllamaChatNodeData

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

      {/* 模型选择 */}
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
          <option value="">
            使用全局默认 ({globalAIConfig?.defaultModel || '未设置'})
          </option>
          {effectiveLoading ? (
            <option disabled>加载中...</option>
          ) : effectiveModels.length === 0 ? (
            <option disabled>未找到模型</option>
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

      {/* 系统提示词 */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">系统提示词</label>
        <textarea
          value={data.systemPrompt}
          onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all resize-none"
          placeholder="设置 AI 的角色和行为..."
        />
      </div>

      {/* 用户消息 */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          用户消息
          <span className="text-[var(--color-text-muted)] ml-1">(支持 {'{{变量}}'})</span>
        </label>
        <textarea
          value={data.userMessage}
          onChange={(e) => updateNodeData(node.id, { userMessage: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all resize-none"
          placeholder="输入要发送给 AI 的消息..."
        />
      </div>

      {/* 温度 */}
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
        <p className="text-xs text-[var(--color-text-muted)] mt-1">控制输出的随机性，值越高越随机</p>
      </div>

      {/* Top P */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Top P: {data.topP}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={data.topP}
          onChange={(e) => updateNodeData(node.id, { topP: parseFloat(e.target.value) })}
          className="w-full"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">控制词汇的多样性</p>
      </div>

      {/* 最大 Token 数 */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">最大 Token 数</label>
        <input
          type="number"
          min="1"
          max="32768"
          value={data.maxTokens}
          onChange={(e) => updateNodeData(node.id, { maxTokens: parseInt(e.target.value) })}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">限制生成的最大长度</p>
      </div>

      {/* 流式输出 */}
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
    </div>
  )
}
