import { useState, useEffect } from 'react'
import type { WorkflowNode, ReactAgentNodeData, AvailableToolId } from '@/types/node'
import { AVAILABLE_TOOLS } from '@/types/node'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspace-store'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<ReactAgentNodeData>) => void
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

export default function ReactAgentProperties({ node, updateNodeData }: Props) {
  const data = node.data as ReactAgentNodeData
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
      if (isOpenAICompatible) {
        const apiKey = await window.electronAPI.openai.getApiKey('workspace-default')
        const response = await fetch(`${workspaceHost}/v1/models`, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        })
        if (response.ok) {
          const json = await response.json()
          setModels((json.data || []).map((m: { id: string }) => ({ name: m.id })))
        }
      } else {
        const response = await fetch(`${workspaceHost}/api/tags`)
        if (response.ok) {
          const json = await response.json()
          setModels(json.models || [])
        }
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

  const handleSaveApiKey = async (apiKey: string) => {
    if (!apiKey) return
    await window.electronAPI.openai.setApiKey(`react-${node.id}`, apiKey)
  }

  const enabledTools = data.enabledTools || []

  return (
    <div className="space-y-4">
      {/* Model Selection */}
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
          <span className="text-[var(--color-text-muted)] ml-1">(支持 {'{{变量}}'})</span>
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
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">最大迭代次数</label>
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
                    ? 'bg-purple-500/10 border-purple-500/30'
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
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
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
                id="debugModeReact"
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
              <label htmlFor="debugModeReact" className="text-sm text-[var(--color-text)]">
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

      {/* Output Info */}
      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-2">输出说明：</div>
        <div className="space-y-1">
          <div>
            <span className="text-purple-400">最终回答</span>: 智能体的最终答案（唯一输出端口）
          </div>
          <div className="text-[var(--color-text-muted)] mt-2">
            中间步骤（思考、行动、观察）将在节点中实时展示
          </div>
        </div>
      </div>
    </div>
  )
}
