import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useEffect, useRef } from 'react'

/**
 * Hook to get reasoning stream output for a specific node
 * Used for displaying thinking/reasoning content (e.g., DeepSeek R1)
 */
export function useReasoningStream(nodeId: string): string {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)
  const prevLengthRef = useRef(0)

  // Use stable selector to minimize unnecessary re-renders
  const output = useExecutionStore((state) => {
    if (!workspacePath) return ''
    const result = state.getReasoningStreamOutputForWorkspace(workspacePath, nodeId)
    return result
  })

  // Debug: log when output changes
  useEffect(() => {
    if (output.length !== prevLengthRef.current) {
      console.log('[useReasoningStream] Output changed for node:', nodeId, 'length:', output.length, 'preview:', output.substring(0, 50) + '...')
      prevLengthRef.current = output.length
    }
  }, [output, nodeId])

  return output
}
