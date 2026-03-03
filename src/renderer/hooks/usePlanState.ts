import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import type { PlanExecutionState } from '@/types/node'

export function usePlanState(nodeId: string): PlanExecutionState | undefined {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)
  
  return useExecutionStore((state) => {
    if (!workspacePath) {
      return state.planStates.get(nodeId)
    }
    
    const workspaceState = state.workspaces.get(workspacePath)
    return workspaceState?.planStates.get(nodeId)
  })
}
