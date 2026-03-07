import { useExecutionStore } from '@/store/execution-store';
import { useWorkspaceStore } from '@/store/workspace-store';

/**
 * Hook to get streaming output for a specific node in the current workspace.
 * Uses stable selector to minimize unnecessary re-renders.
 */
export function useStreamOutput(nodeId: string): string {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path);

  // Use stable selector - Zustand will only re-render when the returned string changes
  return useExecutionStore((state) => {
    if (!workspacePath) return '';
    return state.getStreamOutputForWorkspace(workspacePath, nodeId);
  });
}
