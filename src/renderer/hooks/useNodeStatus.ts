import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import type { NodeExecutionResult } from '@/types/execution'

const DEBUG = true
const log = (...args: unknown[]) => DEBUG && console.log('[useNodeStatus]', ...args)

export function useNodeStatus(nodeId: string): NodeExecutionResult | undefined {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)
  
  const result = useExecutionStore((state) => {
    if (!workspacePath) {
      const globalResult = state.context?.nodeResults.get(nodeId)
      log('useNodeStatus - no workspacePath, using global', { 
        nodeId, 
        found: !!globalResult,
        status: globalResult?.status
      })
      return globalResult
    }
    
    const workspaceState = state.workspaces.get(workspacePath)
    if (workspaceState) {
      const wsResult = workspaceState.context?.nodeResults.get(nodeId)
      log('useNodeStatus - from workspace', { 
        workspacePath, 
        nodeId, 
        found: !!wsResult,
        status: wsResult?.status,
        workspaceContext: !!workspaceState.context,
        globalCurrentWorkspace: state.currentWorkspacePath
      })
      return wsResult
    }
    
    const fallbackResult = state.context?.nodeResults.get(nodeId)
    log('useNodeStatus - workspace not found, using global fallback', { 
      workspacePath, 
      nodeId, 
      found: !!fallbackResult 
    })
    return fallbackResult
  })
  
  log('useNodeStatus - result', { 
    nodeId, 
    workspacePath, 
    status: result?.status 
  })
  
  return result
}
