import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { X, Loader2, Check, AlertCircle, RefreshCw, Globe } from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import { AI_PROVIDER_PRESETS, type AIProvider } from '@/types/global-config'
import { cn } from '@/lib/utils'

interface GlobalAIConfigPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function GlobalAIConfigPanel({ isOpen, onClose }: GlobalAIConfigPanelProps) {
  const {
    globalAIConfig,
    isGlobalAIEnabled,
    availableModels,
    isLoadingModels,
    setGlobalAIConfig,
    clearGlobalAIConfig,
    fetchModels,
  } = useSettingsStore()

  const [enabled, setEnabled] = useState(false)
  const [provider, setProvider] = useState<AIProvider>('openai')
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [name, setName] = useState('')

  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // 初始化表单
  useEffect(() => {
    if (globalAIConfig) {
      setEnabled(globalAIConfig.enabled)
      setProvider(globalAIConfig.provider)
      setApiEndpoint(globalAIConfig.apiEndpoint)
      setDefaultModel(globalAIConfig.defaultModel || '')
      setName(globalAIConfig.name || '')
    }
  }, [globalAIConfig])

  // 加载 API Key
  useEffect(() => {
    if (isOpen) {
      window.electronAPI.globalAI.getApiKey().then(key => {
        setApiKey(key || '')
      })
    }
  }, [isOpen])

  // Provider 变化时自动填充预设
  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider)
    const preset = AI_PROVIDER_PRESETS[newProvider]
    setApiEndpoint(preset.endpoint)
    setName(preset.name)
    setTestResult(null)
  }

  // 测试连接
  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)

    try {
      const result = await window.electronAPI.globalAI.testConnection({
        apiEndpoint,
        apiKey: apiKey || undefined,
      })

      setTestResult(result)

      if (result.success && result.models?.length) {
        // 自动选择第一个模型
        if (!defaultModel) {
          setDefaultModel(result.models[0].id)
        }
      }
    } catch (error) {
      setTestResult({ success: false, error: (error as Error).message })
    } finally {
      setIsTesting(false)
    }
  }

  // 仅保存配置（不关闭弹框）
  const saveConfig = async () => {
    try {
      await setGlobalAIConfig(
        {
          enabled,
          provider,
          apiEndpoint,
          defaultModel: defaultModel || undefined,
          name: name || AI_PROVIDER_PRESETS[provider].name,
        },
        apiKey
      )
    } catch (error) {
      console.error('Failed to save:', error)
      throw error
    }
  }

  // 刷新模型列表
  const handleRefreshModels = async () => {
    // 先保存当前配置，然后刷新
    await saveConfig()
    await fetchModels()
  }

  // 保存配置并关闭
  const handleSave = async () => {
    setIsSaving(true)

    try {
      await saveConfig()
      onClose() // 保存成功后关闭弹框
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // 清除配置
  const handleClear = async () => {
    if (confirm('确定要清除全局 AI 配置吗？这将恢复使用各工作区的独立配置。')) {
      await clearGlobalAIConfig()
      setEnabled(false)
      setApiEndpoint('')
      setApiKey('')
      setDefaultModel('')
      setName('')
      setProvider('openai')
      setTestResult(null)
    }
  }

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
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              className="w-full max-w-lg bg-[var(--color-bg-elevated)] rounded-xl shadow-2xl border border-[var(--color-border-subtle)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 标题栏 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-semibold">全局 AI 配置</h2>
                  <span className="text-xs text-[var(--color-text-muted)] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                    最高优先级
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 配置内容 */}
              <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
                {/* 启用开关 */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium">启用全局配置</label>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      启用后将覆盖所有工作区和节点的 AI 配置
                    </p>
                  </div>
                  <button
                    onClick={() => setEnabled(!enabled)}
                    className={cn(
                      'relative w-12 h-6 rounded-full transition-colors',
                      enabled ? 'bg-purple-500' : 'bg-[var(--color-bg-input)]'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                        enabled ? 'translate-x-7' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>

                {enabled && (
                  <>
                    {/* Provider 选择 */}
                    <div>
                      <label className="block text-sm font-medium mb-2">提供商</label>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(AI_PROVIDER_PRESETS) as AIProvider[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => handleProviderChange(p)}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                              provider === p
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                : 'bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)]'
                            )}
                          >
                            {AI_PROVIDER_PRESETS[p].name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* API 端点 */}
                    <div>
                      <label className="block text-sm font-medium mb-2">API 端点</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={apiEndpoint}
                          onChange={(e) => {
                            setApiEndpoint(e.target.value)
                            setTestResult(null)
                          }}
                          placeholder="https://api.openai.com/v1"
                          className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                        <button
                          onClick={handleTest}
                          disabled={isTesting || !apiEndpoint}
                          className="px-3 py-2 rounded-lg bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50 transition-colors text-sm"
                        >
                          {isTesting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            '测试'
                          )}
                        </button>
                      </div>
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        API Key
                        {provider === 'ollama' && (
                          <span className="text-[var(--color-text-muted)] ml-1">(Ollama 可留空)</span>
                        )}
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      />
                    </div>

                    {/* 测试结果 */}
                    {testResult && (
                      <div
                        className={cn(
                          'p-3 rounded-lg flex items-start gap-2',
                          testResult.success
                            ? 'bg-green-500/10 border border-green-500/20'
                            : 'bg-red-500/10 border border-red-500/20'
                        )}
                      >
                        {testResult.success ? (
                          <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div className="text-sm">
                          {testResult.success ? (
                            <span className="text-green-400">连接成功</span>
                          ) : (
                            <span className="text-red-400">{testResult.error}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 模型选择 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">默认模型</label>
                        <button
                          onClick={handleRefreshModels}
                          disabled={isLoadingModels}
                          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        >
                          <RefreshCw className={cn('w-3 h-3', isLoadingModels && 'animate-spin')} />
                          刷新
                        </button>
                      </div>

                      {availableModels.length > 0 ? (
                        <select
                          value={defaultModel}
                          onChange={(e) => setDefaultModel(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        >
                          <option value="">选择模型...</option>
                          {availableModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name || m.id}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={defaultModel}
                          onChange={(e) => setDefaultModel(e.target.value)}
                          placeholder="例如: gpt-4o, deepseek-chat"
                          className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                      )}
                    </div>

                    {/* 当前状态提示 */}
                    {isGlobalAIEnabled && (
                      <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <p className="text-xs text-purple-400">
                          全局配置已启用。所有工作区和节点将使用此配置。
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between gap-2 px-4 py-3 border-t border-[var(--color-border-subtle)]">
                <button
                  onClick={handleClear}
                  className="px-4 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  清除配置
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)] transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
