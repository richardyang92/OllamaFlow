import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

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

          // Set first model as default if current model is empty
          if (!defaultModel && json.models?.length > 0) {
            onModelChange(json.models[0].name)
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      } else {
        // OpenAI compatible endpoint
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

          // Set first model as default if current model is empty
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

  // Auto-check connection when endpoint changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (aiBackend === 'ollama' ? apiEndpoint : (apiEndpoint && apiKey)) {
        checkConnection()
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [aiBackend, apiEndpoint, apiKey, checkConnection])

  // Reset status when switching backend
  useEffect(() => {
    setConnectionStatus('idle')
    setConnectionError(null)
    setModels([])
    setManualModelInput(false)
  }, [aiBackend])

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'checking':
        return <svg className="animate-spin h-4 w-4 text-blue-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      case 'success':
        return <span className="text-green-400">✓</span>
      case 'error':
        return <span className="text-red-400">✕</span>
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
        <h3 className="text-xl font-medium text-white mb-2">AI 配置</h3>
        <p className="text-sm text-zinc-400">
          配置您的 AI 后端和默认模型
        </p>
      </div>

      <div className="space-y-4">
        {/* Backend Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            AI 后端
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onBackendChange('ollama')}
              className={`p-3 rounded-lg border transition-all text-left ${
                aiBackend === 'ollama'
                  ? 'bg-purple-500/20 border-purple-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
              }`}
            >
              <span className="text-lg">🦙</span>
              <p className="text-sm font-medium mt-1">Ollama</p>
              <p className="text-xs text-zinc-500">本地模型</p>
            </button>
            <button
              onClick={() => onBackendChange('openai')}
              className={`p-3 rounded-lg border transition-all text-left ${
                aiBackend === 'openai'
                  ? 'bg-blue-500/20 border-blue-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
              }`}
            >
              <span className="text-lg">🌐</span>
              <p className="text-sm font-medium mt-1">OpenAI 兼容</p>
              <p className="text-xs text-zinc-500">远程 API</p>
            </button>
          </div>
        </div>

        {/* API Endpoint */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            {aiBackend === 'ollama' ? 'Ollama 主机地址' : 'API 端点'}
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={apiEndpoint}
                onChange={(e) => onEndpointChange(e.target.value)}
                placeholder={aiBackend === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {getStatusIcon()}
              </div>
            </div>
            <button
              onClick={checkConnection}
              disabled={isLoadingModels || (aiBackend === 'openai' && !apiKey)}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-300 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              测试
            </button>
          </div>
        </div>

        {/* API Key (OpenAI only) */}
        {aiBackend === 'openai' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              API Key <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
        )}

        {/* Connection Status */}
        {connectionError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-red-400">⚠️</span>
              <div>
                <p className="text-sm text-red-400">连接失败</p>
                <p className="text-xs text-zinc-500 mt-1">{connectionError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Model Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            默认模型
          </label>

          {models.length > 0 && !manualModelInput ? (
            <div className="space-y-2">
              <select
                value={defaultModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-all"
              >
                <option value="" className="bg-zinc-800">选择模型...</option>
                {models.map((model) => (
                  <option key={model.name} value={model.name} className="bg-zinc-800">
                    {model.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setManualModelInput(true)}
                className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
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
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
              />
              {models.length > 0 && (
                <button
                  onClick={() => setManualModelInput(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                  从列表中选择
                </button>
              )}
            </div>
          )}
        </div>

        {/* Help */}
        {aiBackend === 'ollama' && connectionStatus === 'error' && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-yellow-400">💡</span>
              <div className="text-xs text-zinc-400">
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
