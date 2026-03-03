import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import type { ReActExecutionState } from '@/types/node'

const DEBUG = true
const log = (...args: unknown[]) => DEBUG && console.log('[useReActState]', ...args)

export function useReActState(nodeId: string): ReActExecutionState | undefined {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)

  const result = useExecutionStore((state) => {
    if (!workspacePath) {
      log('useReActState - no workspacePath', { nodeId, workspacePath })
      return undefined
    }

    const wsResult = state.getReActStateForWorkspace(workspacePath, nodeId)
    log('useReActState - from workspace', {
      workspacePath,
      nodeId,
      found: !!wsResult,
    })
    return wsResult
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
