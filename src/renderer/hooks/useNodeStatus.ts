import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import type { NodeExecutionResult } from '@/types/execution'

/**
 * Hook to get node execution status for a specific node in the current workspace.
 * Uses stable selector to minimize unnecessary re-renders.
 */
export function useNodeStatus(nodeId: string): NodeExecutionResult | undefined {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)

  // Subscribe to executions map changes and extract the specific node's status
  // Using JSON.stringify for comparison ensures we detect object content changes
  return useExecutionStore(
    (state) => {
      if (!workspacePath) return undefined

      const activeExecutionId = state.getActiveExecution(workspacePath)
      if (!activeExecutionId) return undefined

      const execution = state.executions.get(activeExecutionId)
      return execution?.context?.nodeResults.get(nodeId)
    },
    (a, b) => {
      // Custom equality function to detect status changes
      if (a === b) return true
      if (!a || !b) return a === b
      return a.status === b.status &&
             a.nodeId === b.nodeId &&
             a.timestamp === b.timestamp
    }
  )
}
