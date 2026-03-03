import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import type { ReActExecutionState } from '@/types/node'

const DEBUG = true
const log = (...args: unknown[]) => DEBUG && console.log('[useReActState]', ...args)

export function useReActState(nodeId: string): ReActExecutionState | undefined {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)

  const result = useExecutionStore((state) => {
    const wsPath = workspacePath || state.currentWorkspacePath
    if (!wsPath) {
      log('useReActState - no workspacePath', { nodeId, workspacePath, currentWsPath: state.currentWorkspacePath })
      return undefined
    }

    const workspaceState = state.workspaces.get(wsPath)
    if (workspaceState) {
      const wsResult = workspaceState.reactAgentStates.get(nodeId)
      log('useReActState - from workspace', {
        workspacePath: wsPath,
        nodeId,
        found: !!wsResult,
        workspaceKeys: Array.from(workspaceState.reactAgentStates.keys()),
        allWorkspacePaths: Array.from(state.workspaces.keys())
      })
      return wsResult
    }

    log('useReActState - workspace not found', { workspacePath: wsPath, nodeId })
    return undefined
  })

  log('useReActState - result', {
    nodeId,
    workspacePath,
    hasResult: !!result,
    isRunning: result?.isRunning,
    stepsCount: result?.steps?.length
  })

  return result
}
