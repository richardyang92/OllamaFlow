import { useState, useEffect, useRef } from 'react'
import type { WorkflowNode, SmartRouterNodeData, SmartRouterBranch } from '@/types/node'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useUpdateNodeInternals } from '@xyflow/react'
import { useWorkflowStore } from '@/store/workflow-store'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<SmartRouterNodeData>) => void
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

export default function SmartRouterProperties({ node, updateNodeData }: Props) {
  const data = node.data as SmartRouterNodeData
  const [models, setModels] = useState<ModelInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDebugExpanded, setIsDebugExpanded] = useState(false)
  const [hasWorkspaceApiKey, setHasWorkspaceApiKey] = useState(false)

  const updateNodeInternals = useUpdateNodeInternals()
  const { edges, onEdgesChange } = useWorkflowStore()
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const workspaceConfig = useWorkspaceStore((state) => state.currentWorkspace?.config)

  const workspaceHost = workspaceConfig?.ollamaHost || 'http://127.0.0.1:11434'
  const workspaceModel = workspaceConfig?.defaultModel || ''
  const isOpenAICompatible = !isStandardOllamaHost(workspaceHost)

  useEffect(() => {
    const checkWorkspaceApiKey = async () => {
      const key = await window.electronAPI.openai.getApiKey('workspace-default')
      setHasWorkspaceApiKey(!!key)
    }
    checkWorkspaceApiKey()
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

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

  const addBranch = () => {
    if (data.branches.length >= 10) {
      alert('最多只能添加 10 个分支')
      return
    }

    const maxBranchNum = data.branches.reduce((max, b) => {
      const match = b.id.match(/branch-(\d+)/)
      if (match) {
        return Math.max(max, parseInt(match[1], 10))
      }
      return max
    }, 0)

    const newBranch: SmartRouterBranch = {
      id: `branch-${maxBranchNum + 1}`,
      name: `新分支 ${data.branches.length + 1}`,
      description: '',
      isDefault: false,
    }

    const newBranches = [...data.branches, newBranch]
    syncBranchesToOutputs(newBranches)
  }

  const removeBranch = (branchId: string) => {
    const edgesToRemove = edges.filter(
      edge => edge.source === node.id && edge.sourceHandle === branchId
    )
    
    if (edgesToRemove.length > 0) {
      onEdgesChange(edgesToRemove.map(edge => ({
        type: 'remove',
        id: edge.id,
      })))
    }

    const newBranches = data.branches.filter(b => b.id !== branchId)
    syncBranchesToOutputs(newBranches)
  }

  const setDefaultBranch = (branchId: string) => {
    const newBranches = data.branches.map(b => ({
      ...b,
      isDefault: b.id === branchId
    }))
    syncBranchesToOutputs(newBranches)
  }

  const updateBranch = (branchId: string, updates: Partial<SmartRouterBranch>) => {
    const newBranches = data.branches.map(b =>
      b.id === branchId ? { ...b, ...updates } : b
    )
    syncBranchesToOutputs(newBranches)
  }

  const syncBranchesToOutputs = (newBranches: SmartRouterBranch[]) => {
    const newOutputs = newBranches.map(b => ({
      id: b.id,
      name: b.id,
      label: b.name,
      dataType: 'any' as const,
    }))

    // 清除之前的定时器
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // 更新节点数据
    updateNodeData(node.id, {
      branches: newBranches,
      outputs: newOutputs,
    })

    // 获取当前连接到该节点的边
    const relatedEdges = edges.filter(e => e.source === node.id)

    if (relatedEdges.length > 0) {
      // 保存当前边的引用
      const savedEdges = relatedEdges.map(edge => ({ ...edge }))

      // 先移除边
      const remainingEdges = useWorkflowStore.getState().edges.filter(e => e.source !== node.id)
      useWorkflowStore.setState({ edges: remainingEdges })

      // 等待 DOM 更新后重新添加边
      updateTimeoutRef.current = setTimeout(() => {
        // 强制 DOM 重排
        const nodeElement = document.querySelector(`[data-id="${node.id}"]`)
        if (nodeElement) {
          void nodeElement.getBoundingClientRect()
        }

        updateNodeInternals(node.id)

        // 再等待一段时间后重新添加边
        updateTimeoutRef.current = setTimeout(() => {
          // 生成新的边 ID 强制完全重新创建
          const timestamp = Date.now()
          const newRelatedEdges = savedEdges.map((edge, index) => ({
            ...edge,
            id: `${edge.id.split('-r-')[0]}-r-${timestamp}-${index}`,
          }))

          const currentEdges = useWorkflowStore.getState().edges
          useWorkflowStore.setState({ edges: [...currentEdges, ...newRelatedEdges] })

          // 最后再调用一次 updateNodeInternals
          requestAnimationFrame(() => {
            updateNodeInternals(node.id)
          })
        }, 100)
      }, 100)
    } else {
      // 没有边连接时，只需更新 node internals
      updateTimeoutRef.current = setTimeout(() => {
        updateNodeInternals(node.id)
      }, 100)
    }
  }

  const handleSaveApiKey = async (apiKey: string) => {
    if (!apiKey) return
    await window.electronAPI.openai.setApiKey(`router-${node.id}`, apiKey)
  }

  const defaultBranch = data.branches.find(b => b.isDefault)

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-[var(--color-text-muted)]">
            分支列表 ({data.branches.length}/10)
          </label>
          <button
            onClick={addBranch}
            disabled={data.branches.length >= 10}
            className={cn(
              "text-xs px-2 py-1 rounded",
              data.branches.length >= 10
                ? "text-[var(--color-text-muted)] cursor-not-allowed"
                : "text-blue-400 hover:bg-blue-500/10"
            )}
          >
            + 添加分支
          </button>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {data.branches.map(branch => (
            <div
              key={branch.id}
              className="border border-[var(--color-border-subtle)] rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  name={`defaultBranch-${node.id}`}
                  checked={branch.isDefault}
                  onChange={() => setDefaultBranch(branch.id)}
                  className="w-3.5 h-3.5 rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-input)]"
                />
                <span className="text-xs text-[var(--color-text-muted)]">设为默认</span>
                <button
                  onClick={() => removeBranch(branch.id)}
                  className="ml-auto text-red-400 text-xs hover:bg-red-500/10 px-2 py-0.5 rounded"
                >
                  删除
                </button>
              </div>

              <input
                type="text"
                value={branch.name}
                onChange={(e) => updateBranch(branch.id, { name: e.target.value })}
                placeholder="分支名称"
                className="w-full px-2 py-1.5 text-sm mb-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)]"
              />

              <textarea
                value={branch.description}
                onChange={(e) => updateBranch(branch.id, { description: e.target.value })}
                placeholder="描述此分支的用途，AI 将根据此描述进行匹配..."
                rows={2}
                className="w-full px-2 py-1.5 text-xs resize-none bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)]"
              />
            </div>
          ))}

          {data.branches.length === 0 && (
            <div className="text-center text-xs text-[var(--color-text-muted)] py-4 border border-dashed border-[var(--color-border-subtle)] rounded-lg">
              暂无分支，点击"添加分支"创建
            </div>
          )}
        </div>

        {!defaultBranch && data.branches.length > 0 && (
          <div className="mt-2 text-xs text-amber-500 bg-amber-500/10 px-2 py-1.5 rounded border border-amber-500/20">
            ⚠️ 建议设置一个默认分支，以便 AI 无法确定时使用
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          {data.debugMode?.enabled ? '模型 (Debug Mode)' : '模型'}
        </label>
        {data.debugMode?.enabled ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="text-green-400">🔬</span>
              <span className="text-sm text-[var(--color-text)]">{data.debugMode?.model || 'gpt-4o'}</span>
              <span className="text-xs text-[var(--color-text-muted)] ml-auto">OpenAI</span>
            </div>
          </div>
        ) : (
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

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          路由提示词
          <span className="text-[var(--color-text-muted)] ml-1">(支持 {'{{变量}}'})</span>
        </label>
        <textarea
          value={data.routingPrompt}
          onChange={(e) => updateNodeData(node.id, { routingPrompt: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all resize-none"
          placeholder="根据输入内容，选择最合适的分支..."
        />
      </div>

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
          值越低越确定，值越高越随机
        </p>
      </div>

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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`debugModeRouter-${node.id}`}
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
              <label htmlFor={`debugModeRouter-${node.id}`} className="text-sm text-[var(--color-text)]">
                启用 Debug Mode
              </label>
            </div>

            {data.debugMode?.enabled && (
              <>
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
                </div>

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

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-2">输出端口：</div>
        {data.branches.length > 0 ? (
          <div className="space-y-1">
            {data.branches.map(branch => (
              <div key={branch.id} className="flex items-center gap-2">
                {branch.isDefault && <span className="text-amber-500">★</span>}
                <span className="text-[var(--color-text)]">{branch.name}</span>
                <span className="text-[var(--color-text-muted)] ml-auto">{branch.id}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[var(--color-text-muted)]">暂无分支</div>
        )}
        <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)] text-[var(--color-text-muted)]">
          只有被选中的分支会传递数据给下游节点
        </div>
      </div>
    </div>
  )
}
