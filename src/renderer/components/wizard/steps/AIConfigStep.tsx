import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Check, X, Lightbulb } from 'lucide-react'

type AIBackend = 'ollama' | 'openai'

interface ModelInfo {
  name: string
  modified_at?: string
  size?: number
}

interface AIConfigStepProps {
  aiBackend: AIBackend
  apiEndpoint: string
  apiKey: string
  defaultModel: string
  onBackendChange: (backend: AIBackend) => void
  onEndpointChange: (endpoint: string) => void
  onApiKeyChange: (key: string) => void
  onModelChange: (model: string) => void
}

type ConnectionStatus = 'idle' | 'checking' | 'success' | 'error'

export default function AIConfigStep({
  aiBackend,
  apiEndpoint,
  apiKey,
  defaultModel,
  onBackendChange,
  onEndpointChange,
  onApiKeyChange,
  onModelChange,
}: AIConfigStepProps) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [manualModelInput, setManualModelInput] = useState(false)

  const checkConnection = useCallback(async () => {
    setConnectionStatus('checking')
    setConnectionError(null)
    setIsLoadingModels(true)

    try {
      if (aiBackend === 'ollama') {
        const response = await fetch(`${apiEndpoint}/api/tags`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const json = await response.json()
          setModels(json.models || [])
          setConnectionStatus('success')

          if (!defaultModel && json.models?.length > 0) {
            onModelChange(json.models[0].name)
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      } else {
        const response = await fetch(`${apiEndpoint}/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        })

        if (response.ok) {
          const json = await response.json()
          const modelList = (json.data || []).map((m: { id: string }) => ({
            name: m.id,
          }))
          setModels(modelList)
          setConnectionStatus('success')

          if (!defaultModel && modelList.length > 0) {
            onModelChange(modelList[0].name)
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      }
    } catch (error) {
      setConnectionStatus('error')
      setConnectionError((error as Error).message)
      setModels([])
    } finally {
      setIsLoadingModels(false)
    }
  }, [aiBackend, apiEndpoint, apiKey, defaultModel, onModelChange])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (aiBackend === 'ollama' ? apiEndpoint : (apiEndpoint && apiKey)) {
        checkConnection()
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [aiBackend, apiEndpoint, apiKey, checkConnection])

  useEffect(() => {
    setConnectionStatus('idle')
    setConnectionError(null)
    setModels([])
    setManualModelInput(false)
  }, [aiBackend])

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'checking':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
      case 'success':
        return <Check className="w-4 h-4 text-green-400" />
      case 'error':
        return <X className="w-4 h-4 text-red-400" />
      default:
        return null
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-xl font-medium text-[var(--color-text)] mb-2">AI 配置</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          配置您的 AI 后端和默认模型
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text)]">
            AI 后端
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onBackendChange('ollama')}
              className={`p-3 rounded-lg border transition-all text-left ${
                aiBackend === 'ollama'
                  ? 'bg-purple-500/20 border-purple-500/50 text-[var(--color-text)]'
                  : 'bg-[var(--color-bg-input)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              <p className="text-sm font-medium mt-1">Ollama</p>
              <p className="text-xs text-[var(--color-text-muted)]">本地模型</p>
            </button>
            <button
              onClick={() => onBackendChange('openai')}
              className={`p-3 rounded-lg border transition-all text-left ${
                aiBackend === 'openai'
                  ? 'bg-blue-500/20 border-blue-500/50 text-[var(--color-text)]'
                  : 'bg-[var(--color-bg-input)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              <p className="text-sm font-medium mt-1">OpenAI 兼容</p>
              <p className="text-xs text-[var(--color-text-muted)]">远程 API</p>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text)]">
            {aiBackend === 'ollama' ? 'Ollama 主机地址' : 'API 端点'}
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={apiEndpoint}
                onChange={(e) => onEndpointChange(e.target.value)}
                placeholder={aiBackend === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'}
                className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-blue-500/50 transition-all pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {getStatusIcon()}
              </div>
            </div>
            <button
              onClick={checkConnection}
              disabled={isLoadingModels || (aiBackend === 'openai' && !apiKey)}
              className="px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-border)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              测试
            </button>
          </div>
        </div>

        {aiBackend === 'openai' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text)]">
              API Key <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
        )}

        {connectionError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-400">连接失败</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{connectionError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text)]">
            默认模型
          </label>

          {models.length > 0 && !manualModelInput ? (
            <div className="space-y-2">
              <select
                value={defaultModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-blue-500/50 transition-all"
              >
                <option value="" className="bg-[var(--color-bg-input)]">选择模型...</option>
                {models.map((model) => (
                  <option key={model.name} value={model.name} className="bg-[var(--color-bg-input)]">
                    {model.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setManualModelInput(true)}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                手动输入模型名称
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={defaultModel}
                onChange={(e) => onModelChange(e.target.value)}
                placeholder="例如: llama3.1, gpt-4"
                className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
              />
              {models.length > 0 && (
                <button
                  onClick={() => setManualModelInput(false)}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  从列表中选择
                </button>
              )}
            </div>
          )}
        </div>

        {aiBackend === 'ollama' && connectionStatus === 'error' && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <div className="text-xs text-[var(--color-text-muted)]">
                <p>如果 Ollama 未运行，请先启动 Ollama 服务。</p>
                <p className="mt-1">
                  或者可以切换到 "OpenAI 兼容" 模式使用其他 API 端点。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
