import { useState, useEffect } from 'react'
import type { WorkflowNode, PlanNodeData } from '@/types/node'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspace-store'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<PlanNodeData>) => void
}

interface ModelInfo {
  name: string
}

function isStandardOllamaHost(host: string): boolean {
  try {
    const url = new URL(host)
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export default function PlanProperties({ node, updateNodeData }: Props) {
  const data = node.data as PlanNodeData
  const [models, setModels] = useState<ModelInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDebugExpanded, setIsDebugExpanded] = useState(false)
  
  const workspaceConfig = useWorkspaceStore((state) => state.currentWorkspace?.config)
  const workspaceHost = workspaceConfig?.ollamaHost || 'http://127.0.0.1:11434'
  const workspaceModel = workspaceConfig?.defaultModel || ''
  const isOpenAICompatible = !isStandardOllamaHost(workspaceHost)
  
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
  
  const handleSaveApiKey = async (apiKey: string) => {
    if (!apiKey) return
    await window.electronAPI.openai.setApiKey(`plan-${node.id}`, apiKey)
  }
  
  return (
    <div className="space-y-4">
      {/* Model selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-text)]">AI 模型</label>
        <div className="flex gap-2">
          <select
            value={data.model}
            onChange={(e) => updateNodeData(node.id, { model: e.target.value })}
            className="flex-1 px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all"
          >
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={loadModels}
            disabled={isLoading}
            className="px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] rounded-lg transition-all disabled:opacity-50"
          >
            {isLoading ? '...' : '🔄'}
          </button>
        </div>
      </div>
      
      {/* System prompt */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-text)]">系统提示词</label>
        <textarea
          value={data.systemPrompt}
          onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all resize-none"
          placeholder="输入系统提示词..."
        />
        <p className="text-xs text-[var(--color-text-muted)]">
          定义 AI 的角色和行为方式
        </p>
      </div>
      
      {/* Temperature */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-text)]">
          温度: {data.temperature}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={data.temperature}
          onChange={(e) => updateNodeData(node.id, { temperature: parseFloat(e.target.value) })}
          className="w-full h-2 bg-[var(--color-bg-input)] rounded-lg appearance-none cursor-pointer"
        />
        <p className="text-xs text-[var(--color-text-muted)]">
          较低的值更确定，较高的值更随机
        </p>
      </div>
      
      {/* Max Tokens */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-text)]">最大令牌数</label>
        <input
          type="number"
          value={data.maxTokens}
          onChange={(e) => updateNodeData(node.id, { maxTokens: parseInt(e.target.value) || 4096 })}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all"
        />
        <p className="text-xs text-[var(--color-text-muted)]">
          生成的最大令牌数量
        </p>
      </div>
      
      {/* Debug Mode (for OpenAI-compatible APIs) */}
      {isOpenAICompatible && (
        <div className="space-y-2">
          <button
            onClick={() => setIsDebugExpanded(!isDebugExpanded)}
            className="flex items-center justify-between w-full px-3 py-2 bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] rounded-lg transition-all"
          >
            <span className="text-xs font-medium text-[var(--color-text)]">
              🔬 Debug Mode (OpenAI)
            </span>
            <span className={cn('text-xs transition-transform', isDebugExpanded && 'rotate-180')}>
              ▼
            </span>
          </button>
          
          {isDebugExpanded && (
            <div className="space-y-3 p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.debugMode?.enabled || false}
                  onChange={(e) =>
                    updateNodeData(node.id, {
                      debugMode: {
                        enabled: e.target.checked,
                        apiEndpoint: data.debugMode?.apiEndpoint || workspaceHost,
                        apiKey: '',
                        model: data.debugMode?.model || workspaceModel,
                      },
                    })
                  }
                  className="w-4 h-4 rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-input)] text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                />
                <span className="text-sm text-[var(--color-text)]">启用 Debug Mode</span>
              </label>
              
              {data.debugMode?.enabled && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-[var(--color-text-muted)]">API Key</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      onBlur={(e) => handleSaveApiKey(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)]"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-[var(--color-text-muted)]">模型</label>
                    <input
                      type="text"
                      value={data.debugMode.model}
                      onChange={(e) =>
                        updateNodeData(node.id, {
                          debugMode: { ...data.debugMode!, model: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)]"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
