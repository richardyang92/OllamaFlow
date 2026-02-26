import { useState, useEffect } from 'react'
import type { WorkflowNode, OllamaChatNodeData } from '@/types/node'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspace-store'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<OllamaChatNodeData>) => void
}

interface ModelInfo {
  name: string
}

// Check if the host is a standard Ollama endpoint
function isStandardOllamaHost(host: string): boolean {
  try {
    const url = new URL(host)
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export default function OllamaChatProperties({ node, updateNodeData }: Props) {
  const data = node.data as OllamaChatNodeData
  const [models, setModels] = useState<ModelInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDebugExpanded, setIsDebugExpanded] = useState(false)
  const [hasWorkspaceApiKey, setHasWorkspaceApiKey] = useState(false)

  // Get workspace config
  const workspaceConfig = useWorkspaceStore((state) => state.currentWorkspace?.config)
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)
  const updateWorkspaceConfig = useWorkspaceStore((state) => state.updateConfig)

  // Determine if workspace is using OpenAI-compatible API
  const workspaceHost = workspaceConfig?.ollamaHost || 'http://127.0.0.1:11434'
  const workspaceModel = workspaceConfig?.defaultModel || ''
  const isOpenAICompatible = !isStandardOllamaHost(workspaceHost)

  // Check if workspace has a default API key
  useEffect(() => {
    const checkWorkspaceApiKey = async () => {
      const key = await window.electronAPI.openai.getApiKey('workspace-default')
      setHasWorkspaceApiKey(!!key)
    }
    checkWorkspaceApiKey()
  }, [])

  // Auto-configure debug mode if workspace is using OpenAI-compatible API and debug mode not set
  useEffect(() => {
    if (isOpenAICompatible && !data.debugMode?.enabled && workspaceModel) {
      updateNodeData(node.id, {
        debugMode: {
          enabled: true,
          apiEndpoint: workspaceHost,
          apiKey: '',
          model: workspaceModel,
        },
      })
    }
  }, [isOpenAICompatible, data.debugMode?.enabled, workspaceHost, workspaceModel])

  useEffect(() => {
    loadModels()
  }, [workspaceHost])

  const loadModels = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${workspaceHost}/api/tags`)
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

  const handleSaveApiKey = async (apiKey: string) => {
    if (!apiKey) return
    await window.electronAPI.openai.setApiKey(`ollama-${node.id}`, apiKey)
  }

  return (
    <div className="space-y-4">
      {/* 模型选择 */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          {data.debugMode?.enabled ? '模型 (Debug Mode)' : '模型'}
        </label>
        {data.debugMode?.enabled ? (
          // Show OpenAI model info when debug mode is enabled
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="text-green-400">🔬</span>
              <span className="text-sm text-[var(--color-text)]">{data.debugMode?.model || 'gpt-4o'}</span>
              <span className="text-xs text-[var(--color-text-muted)] ml-auto">OpenAI</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Debug Mode 已启用，使用 OpenAI API。可在下方 Debug Mode 区域修改配置。
            </p>
          </div>
        ) : (
          // Show Ollama model selector when debug mode is disabled
          <>
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
          </>
        )}
      </div>

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

      {/* 调试模式 - 可折叠区域 */}
      <div className="border-t border-[var(--color-border-subtle)] pt-4">
        <button
          type="button"
          onClick={() => setIsDebugExpanded(!isDebugExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-2">
            <span>🔬</span> Debug Mode (OpenAI)
            {data.debugMode?.enabled && (
              <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                已启用
              </span>
            )}
          </span>
          <span
            className={cn(
              'text-[var(--color-text-muted)] transition-transform',
              isDebugExpanded && 'rotate-180'
            )}
          >
            ▼
          </span>
        </button>

        {isDebugExpanded && (
          <div className="mt-3 space-y-3">
            {/* 启用开关 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="debugMode"
                checked={data.debugMode?.enabled || false}
                onChange={(e) =>
                  updateNodeData(node.id, {
                    debugMode: {
                      enabled: e.target.checked,
                      apiEndpoint: data.debugMode?.apiEndpoint || 'https://api.openai.com/v1',
                      apiKey: data.debugMode?.apiKey || '',
                      model: data.debugMode?.model || 'gpt-4o',
                    },
                  })
                }
                className="rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-input)]"
              />
              <label htmlFor="debugMode" className="text-sm text-[var(--color-text)]">
                启用 Debug Mode
              </label>
            </div>

            {data.debugMode?.enabled && (
              <>
                {/* API Endpoint */}
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">API Endpoint</label>
                  <input
                    type="text"
                    value={data.debugMode?.apiEndpoint || ''}
                    onChange={(e) =>
                      updateNodeData(node.id, {
                        debugMode: { ...data.debugMode!, apiEndpoint: e.target.value },
                      })
                    }
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all"
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">API Key</label>
                  <input
                    type="password"
                    placeholder={hasWorkspaceApiKey ? "使用工作区默认 Key（留空）" : "sk-..."}
                    onBlur={(e) => handleSaveApiKey(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all"
                  />
                  {hasWorkspaceApiKey ? (
                    <p className="text-xs text-green-500 mt-1">✓ 已有工作区默认 API Key，可留空使用</p>
                  ) : (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">安全存储于本地，不会保存到工作流文件</p>
                  )}
                </div>

                {/* Model Input */}
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">模型名称</label>
                  <input
                    type="text"
                    value={data.debugMode?.model || ''}
                    onChange={(e) =>
                      updateNodeData(node.id, {
                        debugMode: { ...data.debugMode!, model: e.target.value },
                      })
                    }
                    placeholder="gpt-4o, deepseek-chat, etc."
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all"
                  />
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">支持 OpenAI 兼容 API 的模型名称</p>
                </div>

                {/* Save to Workspace */}
                <button
                  onClick={() => {
                    if (workspacePath && data.debugMode) {
                      updateWorkspaceConfig({
                        ollamaHost: data.debugMode.apiEndpoint,
                        defaultModel: data.debugMode.model,
                      })
                      window.electronAPI.workspace.updateConfig(workspacePath, {
                        ollamaHost: data.debugMode.apiEndpoint,
                        defaultModel: data.debugMode.model,
                      })
                    }
                  }}
                  className="w-full px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-sm text-blue-400 transition-all"
                >
                  💾 保存到工作区配置
                </button>

                {/* Info about workspace config */}
                {isOpenAICompatible && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
                    <p className="text-xs text-blue-400">
                      📋 工作区已配置: {workspaceHost} / {workspaceModel}
                    </p>
                  </div>
                )}

                {/* Warning */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                  <p className="text-xs text-amber-400">
                    ⚠️ Debug Mode 将使用配置的 API 端点而非本地 Ollama。可能产生 API 费用。
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
