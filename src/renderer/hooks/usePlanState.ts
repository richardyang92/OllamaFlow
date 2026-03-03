import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import type { PlanExecutionState } from '@/types/node'

export function usePlanState(nodeId: string): PlanExecutionState | undefined {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)

  return useExecutionStore((state) => {
    const wsPath = workspacePath || state.currentWorkspacePath
    if (!wsPath) {
      return undefined
    }

    const workspaceState = state.workspaces.get(wsPath)
    return workspaceState?.planStates.get(nodeId)
  })
}
