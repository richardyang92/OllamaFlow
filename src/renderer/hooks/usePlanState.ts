import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import type { PlanExecutionState } from '@/types/node'

/**
 * Hook to get plan state for a specific node in the current workspace.
 * Uses stable selector to minimize unnecessary re-renders.
 */
export function usePlanState(nodeId: string): PlanExecutionState | undefined {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)

  // Use stable selector - Zustand will only re-render when the returned reference changes
  return useExecutionStore((state) => {
    if (!workspacePath) return undefined
    return state.getPlanStateForWorkspace(workspacePath, nodeId)
  })
}
