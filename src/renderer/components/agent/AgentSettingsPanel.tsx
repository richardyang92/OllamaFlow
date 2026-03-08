import { useState, useEffect } from 'react'
import { X, Loader2, RefreshCw, Globe } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useAgentStore } from '@/store/agent-store'
import { useSettingsStore } from '@/store/settings-store'
import { cn } from '@/lib/utils'

interface AgentSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function AgentSettingsPanel({ isOpen, onClose }: AgentSettingsPanelProps) {
  const {
    provider,
    model,
    apiEndpoint,
    apiKey,
    availableWorkflows,
    setModelConfig,
    loadWorkflows,
  } = useAgentStore()

  const {
    isGlobalAIEnabled,
    globalAIConfig,
    availableModels,
    isLoadingModels,
    fetchModels,
  } = useSettingsStore()

  const [useGlobalConfig, setUseGlobalConfig] = useState(isGlobalAIEnabled)
  const [localProvider, setLocalProvider] = useState<'ollama' | 'openai'>(provider)
  const [localModel, setLocalModel] = useState(model)
  const [localApiEndpoint, setLocalApiEndpoint] = useState(apiEndpoint || '')
  const [localApiKey, setLocalApiKey] = useState(apiKey || '')
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [isLoadingOllamaModels, setIsLoadingOllamaModels] = useState(false)

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // 如果启用了全局配置，默认使用全局配置
  useEffect(() => {
    if (isGlobalAIEnabled) {
      setUseGlobalConfig(true)
    }
  }, [isGlobalAIEnabled])

  // 加载Ollama模型列表
  useEffect(() => {
    if (!useGlobalConfig && localProvider === 'ollama') {
      fetchOllamaModels()
    }
  }, [localProvider, useGlobalConfig])

  // 刷新全局模型列表
  useEffect(() => {
    if (useGlobalConfig && isGlobalAIEnabled) {
      fetchModels()
    }
  }, [useGlobalConfig, isGlobalAIEnabled, fetchModels])

  const fetchOllamaModels = async () => {
    setIsLoadingOllamaModels(true)
    try {
      const ollama = await import('ollama/browser')
      const client = new ollama.Ollama({
        host: localApiEndpoint || 'http://127.0.0.1:11434',
      })
      const response = await client.list()
      setOllamaModels(response.models.map(m => m.name))
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error)
      setOllamaModels([])
    } finally {
      setIsLoadingOllamaModels(false)
    }
  }

  const handleSave = () => {
    if (useGlobalConfig && isGlobalAIEnabled) {
      // 使用全局配置时，只保存模型选择
      setModelConfig({
        provider: globalAIConfig?.provider === 'ollama' ? 'ollama' : 'openai',
        model: localModel || globalAIConfig?.defaultModel || '',
        // 不保存 apiEndpoint 和 apiKey，使用全局配置
      })
    } else {
      // 使用自定义配置
      setModelConfig({
        provider: localProvider,
        model: localModel,
        apiEndpoint: localApiEndpoint || undefined,
        apiKey: localApiKey || undefined,
      })
    }
    onClose()
  }

  const handleRefreshWorkflows = () => {
    loadWorkflows()
  }

  // 使用 Portal 渲染到 body
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* 弹框内容 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              className="w-full max-w-lg bg-[var(--color-bg-elevated)] rounded-xl shadow-2xl border border-[var(--color-border-subtle)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 标题栏 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
                <h2 className="text-lg font-semibold">设置</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 设置内容 */}
              <div className="p-4 max-h-[70vh] overflow-y-auto">
                {/* 全局配置提示 */}
                {isGlobalAIEnabled && useGlobalConfig ? (
                  <>
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Globe className="w-4 h-4 text-purple-400" />
                        <span className="font-medium text-purple-400">
                          使用全局配置
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {globalAIConfig?.name} - {globalAIConfig?.apiEndpoint}
                      </p>
                    </div>

                    {/* 模型选择（使用全局模型列表） */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">模型</label>
                        <button
                          onClick={() => fetchModels()}
                          disabled={isLoadingModels}
                          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        >
                          <RefreshCw className={cn('w-3 h-3', isLoadingModels && 'animate-spin')} />
                          刷新
                        </button>
                      </div>
                      {availableModels.length > 0 ? (
                        <select
                          value={localModel}
                          onChange={(e) => setLocalModel(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        >
                          <option value="">使用全局默认 ({globalAIConfig?.defaultModel})</option>
                          {availableModels.map((m) => (
                            <option key={m.id} value={m.id}>{m.name || m.id}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={localModel}
                          onChange={(e) => setLocalModel(e.target.value)}
                          placeholder={globalAIConfig?.defaultModel || '输入模型名称'}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                      )}
                    </div>

                    <button
                      onClick={() => setUseGlobalConfig(false)}
                      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-4"
                    >
                      使用自定义配置
                    </button>
                  </>
                ) : (
                  <>
                    {/* 如果有全局配置可用，显示切换提示 */}
                    {isGlobalAIEnabled && (
                      <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-purple-400">全局配置可用</span>
                          </div>
                          <button
                            onClick={() => setUseGlobalConfig(true)}
                            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            使用全局配置
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Provider Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">AI 提供商</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setLocalProvider('ollama')}
                          className={cn(
                            'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                            localProvider === 'ollama'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
                          )}
                        >
                          Ollama (本地)
                        </button>
                        <button
                          onClick={() => setLocalProvider('openai')}
                          className={cn(
                            'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                            localProvider === 'openai'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
                          )}
                        >
                          OpenAI 兼容
                        </button>
                      </div>
                    </div>

                    {/* API Endpoint (for both) */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">
                        API 端点
                      </label>
                      <input
                        type="text"
                        value={localApiEndpoint}
                        onChange={(e) => setLocalApiEndpoint(e.target.value)}
                        placeholder={localProvider === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      />
                    </div>

                    {/* Model Selection */}
                    {localProvider === 'ollama' ? (
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">模型</label>
                        <div className="relative">
                          <select
                            value={localModel}
                            onChange={(e) => setLocalModel(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none"
                          >
                            <option value="">选择模型...</option>
                            {ollamaModels.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          {isLoadingOllamaModels && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-400" />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">模型名称</label>
                        <input
                          type="text"
                          value={localModel}
                          onChange={(e) => setLocalModel(e.target.value)}
                          placeholder="例如: gpt-4o, deepseek-chat"
                          className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                      </div>
                    )}

                    {/* API Key (only for OpenAI) */}
                    {localProvider === 'openai' && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">API Key</label>
                        <input
                          type="password"
                          value={localApiKey}
                          onChange={(e) => setLocalApiKey(e.target.value)}
                          placeholder="sk-..."
                          className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Workflows */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">可用工作流</label>
                    <button
                      onClick={handleRefreshWorkflows}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      刷新
                    </button>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {availableWorkflows.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        暂无可用工作流，请先打开一些工作区
                      </p>
                    ) : (
                      availableWorkflows.map((w) => (
                        <div
                          key={w.workspacePath}
                          className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-canvas)] border border-[var(--color-border-subtle)] text-xs"
                        >
                          <span className="font-medium">{w.name}</span>
                          {w.description && (
                            <span className="text-[var(--color-text-muted)] ml-2">
                              - {w.description}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--color-border-subtle)]">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={useGlobalConfig && isGlobalAIEnabled ? false : !localModel}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-purple-500 text-white hover:bg-purple-600',
                    (useGlobalConfig && isGlobalAIEnabled ? false : !localModel) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  保存
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
