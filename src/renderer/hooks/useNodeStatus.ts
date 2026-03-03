import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import type { NodeExecutionResult } from '@/types/execution'

const DEBUG = true
const log = (...args: unknown[]) => DEBUG && console.log('[useNodeStatus]', ...args)

export function useNodeStatus(nodeId: string): NodeExecutionResult | undefined {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)

  const result = useExecutionStore((state) => {
    const wsPath = workspacePath || state.currentWorkspacePath
    if (!wsPath) {
      log('useNodeStatus - no workspacePath', { nodeId, workspacePath, currentWsPath: state.currentWorkspacePath })
      return undefined
    }

    const workspaceState = state.workspaces.get(wsPath)
    if (workspaceState) {
      const wsResult = workspaceState.context?.nodeResults.get(nodeId)
      log('useNodeStatus - from workspace', {
        workspacePath: wsPath,
        nodeId,
        found: !!wsResult,
        status: wsResult?.status,
        workspaceContext: !!workspaceState.context,
      })
      return wsResult
    }

    log('useNodeStatus - workspace not found', { workspacePath: wsPath, nodeId })
    return undefined
  })

  log('useNodeStatus - result', {
    nodeId,
    workspacePath,
    status: result?.status
  })

  return result
}
