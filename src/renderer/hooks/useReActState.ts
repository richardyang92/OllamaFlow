import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import type { ReActExecutionState } from '@/types/node'

const DEBUG = true
const log = (...args: unknown[]) => DEBUG && console.log('[useReActState]', ...args)

export function useReActState(nodeId: string): ReActExecutionState | undefined {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)
  
  const result = useExecutionStore((state) => {
    if (!workspacePath) {
      const globalState = state.reactAgentStates.get(nodeId)
      log('useReActState - no workspacePath, using global state', { 
        nodeId, 
        found: !!globalState,
        globalKeys: Array.from(state.reactAgentStates.keys())
      })
      return globalState
    }
    
    const workspaceState = state.workspaces.get(workspacePath)
    if (workspaceState) {
      const wsResult = workspaceState.reactAgentStates.get(nodeId)
      log('useReActState - from workspace', { 
        workspacePath, 
        nodeId, 
        found: !!wsResult,
        workspaceKeys: Array.from(workspaceState.reactAgentStates.keys()),
        globalCurrentWorkspace: state.currentWorkspacePath,
        allWorkspacePaths: Array.from(state.workspaces.keys())
      })
      return wsResult
    }
    
    const fallbackState = state.reactAgentStates.get(nodeId)
    log('useReActState - workspace not found, using global fallback', { 
      workspacePath, 
      nodeId, 
      found: !!fallbackState 
    })
    return fallbackState
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
