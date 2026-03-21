import { useEffect, useRef } from 'react'
import type { WorkflowNode, SmartRouterNodeData, SmartRouterBranch } from '@/types/node'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings-store'
import { useUpdateNodeInternals } from '@xyflow/react'
import { useWorkflowStore } from '@/store/workflow-store'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<SmartRouterNodeData>) => void
}

export default function SmartRouterProperties({ node, updateNodeData }: Props) {
  const data = node.data as SmartRouterNodeData

  const updateNodeInternals = useUpdateNodeInternals()
  const { edges, onEdgesChange } = useWorkflowStore()
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get global AI config
  const { isGlobalAIEnabled, globalAIConfig, availableModels, isLoadingModels, fetchModels } = useSettingsStore()

  // Use global models
  const effectiveModels = isGlobalAIEnabled ? availableModels : []
  const effectiveLoading = isGlobalAIEnabled ? isLoadingModels : false
  const defaultModel = isGlobalAIEnabled && globalAIConfig ? globalAIConfig.defaultModel || '' : ''

  // 清理定时器
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

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

  const defaultBranch = data.branches.find(b => b.isDefault)

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
          模型
        </label>
        <select
          value={data.model || defaultModel}
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
          className="btn-sci-fi btn-ghost btn-sm mt-2 w-full"
        >
          刷新模型列表
        </button>
      </div>

      {/* 警告提示 */}
      {!isGlobalAIEnabled && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-400">
            请先在设置中配置全局 AI
          </p>
        </div>
      )}

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
