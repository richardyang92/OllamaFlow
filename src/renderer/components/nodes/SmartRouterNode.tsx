import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { Route } from 'lucide-react'
import BaseNode from './BaseNode'
import { SmartRouterNodeData } from '@/types/node'

function SmartRouterNode(props: NodeProps) {
  const { data } = props
  const nodeData = data as SmartRouterNodeData

  const visibleBranches = nodeData.branches.slice(0, 3)
  const hasMore = nodeData.branches.length > 3
  const defaultBranch = nodeData.branches.find((b: { isDefault: boolean }) => b.isDefault)

  return (
    <BaseNode {...props} icon={<Route className="w-4 h-4" />}>
      <div className="space-y-2 w-full">
        <div className="node-primary-badge logic">
          <Route className="w-4 h-4" />
          <span className="font-mono font-semibold text-sm">
            {nodeData.branches.length} 个分支
          </span>
        </div>

        <div className="space-y-1">
          {visibleBranches.map((branch: { id: string; isDefault: boolean; name: string }) => (
            <div key={branch.id} className="flex items-center gap-2">
              {branch.isDefault && (
                <span className="text-amber-500 text-[10px]" title="默认分支">
                  ★
                </span>
              )}
              <span className="text-xs text-[var(--color-text)] truncate flex-1">
                {branch.name}
              </span>
            </div>
          ))}
          {hasMore && (
            <div className="text-xs text-[var(--color-text-muted)]">
              +{nodeData.branches.length - 3} 个分支
            </div>
          )}
          {!defaultBranch && nodeData.branches.length > 0 && (
            <div className="text-[10px] text-amber-500/60 mt-1">
              ⚠️ 未设置默认分支
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(SmartRouterNode)
