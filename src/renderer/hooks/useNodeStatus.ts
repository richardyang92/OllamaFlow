import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import type { NodeExecutionResult } from '@/types/execution'

/**
 * Hook to get node execution status for a specific node in the current workspace.
 * Uses stable selector to minimize unnecessary re-renders.
 */
export function useNodeStatus(nodeId: string): NodeExecutionResult | undefined {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)

  // Use stable selector - Zustand will only re-render when the returned reference changes
  return useExecutionStore((state) => {
    if (!workspacePath) return undefined
    return state.getNodeStatusForWorkspace(workspacePath, nodeId)
  })
}
