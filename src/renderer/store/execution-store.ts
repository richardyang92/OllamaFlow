import { create } from 'zustand'
import type {
  ExecutionStatus,
  ExecutionContext,
  NodeExecutionResult,
  ExecutionLog,
} from '@/types/execution'
import type { ReActExecutionState, ReActStep, TodoItem } from '@/types/node'

const DEBUG = true
const log = (...args: unknown[]) => DEBUG && console.log('[ExecutionStore]', ...args)

interface WorkspaceExecutionState {
  status: ExecutionStatus
  context: ExecutionContext | null
  logs: ExecutionLog[]
  streamingOutput: Map<string, string>
  reactAgentStates: Map<string, ReActExecutionState>
  queueStates: Map<string, unknown[]>
}

interface ExecutionState {
  currentWorkspacePath: string | null
  workspaces: Map<string, WorkspaceExecutionState>
  
  status: ExecutionStatus
  context: ExecutionContext | null
  logs: ExecutionLog[]
  streamingOutput: Map<string, string>
  reactAgentStates: Map<string, ReActExecutionState>
  queueStates: Map<string, unknown[]>

  startExecution: (workspacePath: string, workflowId: string) => void
  pauseExecution: () => void
  resumeExecution: () => void
  cancelExecution: () => void
  completeExecution: (success: boolean) => void
  resetExecution: () => void
  resetWorkspaceExecution: (workspacePath: string) => void
  switchWorkspaceContext: (workspacePath: string) => void
  
  startExecutionForWorkspace: (workspacePath: string, workflowId: string) => void
  pauseExecutionForWorkspace: (workspacePath: string) => void
  resumeExecutionForWorkspace: (workspacePath: string) => void
  cancelExecutionForWorkspace: (workspacePath: string) => void
  completeExecutionForWorkspace: (workspacePath: string, success: boolean) => void
  getExecutionStatusForWorkspace: (workspacePath: string) => ExecutionStatus

  updateNodeStatus: (nodeId: string, result: NodeExecutionResult) => void
  getNodeStatus: (nodeId: string) => NodeExecutionResult | undefined
  getNodeStatusForWorkspace: (workspacePath: string, nodeId: string) => NodeExecutionResult | undefined

  appendStreamOutput: (nodeId: string, chunk: string) => void
  getStreamOutput: (nodeId: string) => string
  clearStreamOutput: (nodeId: string) => void

  addLog: (log: Omit<ExecutionLog, 'id' | 'timestamp' | 'executionId'>) => void
  clearLogs: () => void

  setVariable: (key: string, value: unknown) => void
  getVariable: (key: string) => unknown

  initReActState: (nodeId: string, maxIterations: number) => void
  updateReActStep: (nodeId: string, step: Partial<ReActStep> & { id: string }) => void
  appendReActThought: (nodeId: string, chunk: string) => void
  appendReActObservation: (nodeId: string, chunk: string, isError?: boolean) => void
  setReActFinalAnswer: (nodeId: string, answer: string) => void
  completeReActStep: (nodeId: string, stepId: string) => void
  getReActState: (nodeId: string) => ReActExecutionState | undefined
  getReActStateForWorkspace: (workspacePath: string, nodeId: string) => ReActExecutionState | undefined
  clearReActState: (nodeId: string) => void
  updateReActTodos: (nodeId: string, todos: TodoItem[]) => void

  getQueue: (nodeId: string) => unknown[]
  enqueue: (nodeId: string, item: unknown) => void
  dequeue: (nodeId: string) => unknown | undefined
  clearQueue: (nodeId: string) => void
}

const createEmptyWorkspaceState = (): WorkspaceExecutionState => ({
  status: 'idle',
  context: null,
  logs: [],
  streamingOutput: new Map(),
  reactAgentStates: new Map(),
  queueStates: new Map(),
})

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  currentWorkspacePath: null,
  workspaces: new Map(),
  
  status: 'idle',
  context: null,
  logs: [],
  streamingOutput: new Map(),
  reactAgentStates: new Map(),
  queueStates: new Map(),

  startExecution: (workspacePath, workflowId) => {
    log('startExecution', { workspacePath, workflowId })
    
    const context: ExecutionContext = {
      workflowId,
      executionId: window.crypto.randomUUID(),
      startTime: new Date().toISOString(),
      nodeResults: new Map(),
      variables: {},
    }

    const workspaces = new Map(get().workspaces)
    const existingWorkspace = workspaces.get(workspacePath)
    
    log('startExecution - existing workspace?', !!existingWorkspace, 'workspaceKeys:', Array.from(workspaces.keys()))
    
    workspaces.set(workspacePath, {
      status: 'running',
      context,
      logs: existingWorkspace?.logs || [],
      streamingOutput: new Map(),
      reactAgentStates: new Map(),
      queueStates: new Map(),
    })

    log('startExecution - workspaces after set:', Array.from(workspaces.keys()))
    log('startExecution - setting global state for workspace:', workspacePath)

    set({
      currentWorkspacePath: workspacePath,
      workspaces,
      status: 'running',
      context,
      logs: existingWorkspace?.logs || [],
      streamingOutput: new Map(),
      reactAgentStates: new Map(),
      queueStates: new Map(),
    })

    get().addLog({
      level: 'info',
      message: `Started execution: ${workflowId}`,
    })
  },

  pauseExecution: () => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const newWorkspaces = new Map(workspaces)
    const workspaceState = newWorkspaces.get(currentWorkspacePath)
    if (workspaceState) {
      newWorkspaces.set(currentWorkspacePath, { ...workspaceState, status: 'paused' })
    }

    set({ 
      workspaces: newWorkspaces,
      status: 'paused' 
    })
    get().addLog({ level: 'info', message: 'Execution paused' })
  },

  resumeExecution: () => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const newWorkspaces = new Map(workspaces)
    const workspaceState = newWorkspaces.get(currentWorkspacePath)
    if (workspaceState) {
      newWorkspaces.set(currentWorkspacePath, { ...workspaceState, status: 'running' })
    }

    set({ 
      workspaces: newWorkspaces,
      status: 'running' 
    })
    get().addLog({ level: 'info', message: 'Execution resumed' })
  },

  cancelExecution: () => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const newWorkspaces = new Map(workspaces)
    const workspaceState = newWorkspaces.get(currentWorkspacePath)
    if (workspaceState) {
      newWorkspaces.set(currentWorkspacePath, { 
        ...workspaceState, 
        status: 'cancelled', 
        context: null 
      })
    }

    set({ 
      workspaces: newWorkspaces,
      status: 'cancelled', 
      context: null 
    })
    get().addLog({ level: 'warn', message: 'Execution cancelled' })
  },

  completeExecution: (success) => {
    const { currentWorkspacePath, workspaces } = get()
    log('completeExecution', { success, currentWorkspacePath })
    
    if (!currentWorkspacePath) return

    const newWorkspaces = new Map(workspaces)
    const workspaceState = newWorkspaces.get(currentWorkspacePath)
    if (workspaceState) {
      newWorkspaces.set(currentWorkspacePath, { 
        ...workspaceState, 
        status: success ? 'completed' : 'failed' 
      })
    }

    set({
      workspaces: newWorkspaces,
      status: success ? 'completed' : 'failed',
    })
    get().addLog({
      level: success ? 'info' : 'error',
      message: success ? 'Execution completed' : 'Execution failed',
    })
  },

  resetExecution: () => {
    const { currentWorkspacePath, workspaces } = get()
    log('resetExecution', { currentWorkspacePath })
    
    // Clear global state but preserve workspace state in the Map
    // Only clear workspace state if explicitly requested via resetWorkspaceExecution
    
    set({
      // Don't clear workspaces Map - preserve state for each workspace
      // workspaces: newWorkspaces,  // <-- removed this
      status: 'idle',
      context: null,
      logs: [],
      streamingOutput: new Map(),
      reactAgentStates: new Map(),
      queueStates: new Map(),
    })
    
    log('resetExecution - cleared global state, preserved workspaces:', Array.from(workspaces.keys()))
  },

  resetWorkspaceExecution: (workspacePath: string) => {
    log('resetWorkspaceExecution', { workspacePath })
    
    const workspaces = new Map(get().workspaces)
    workspaces.set(workspacePath, createEmptyWorkspaceState())

    if (get().currentWorkspacePath === workspacePath) {
      set({
        workspaces,
        status: 'idle',
        context: null,
        logs: [],
        streamingOutput: new Map(),
        reactAgentStates: new Map(),
        queueStates: new Map(),
      })
    } else {
      set({ workspaces })
    }
  },

  switchWorkspaceContext: (workspacePath: string) => {
    const workspaces = new Map(get().workspaces)
    let workspaceState = workspaces.get(workspacePath)
    
    log('switchWorkspaceContext', { 
      workspacePath, 
      hasWorkspaceState: !!workspaceState,
      allWorkspacePaths: Array.from(workspaces.keys()),
      workspaceReactStates: workspaceState ? Array.from(workspaceState.reactAgentStates.keys()) : [],
    })
    
    if (!workspaceState) {
      log('switchWorkspaceContext - no existing state, creating empty for:', workspacePath)
      workspaceState = createEmptyWorkspaceState()
      workspaces.set(workspacePath, workspaceState)
    }
    
    log('switchWorkspaceContext - restoring state from workspace:', workspacePath)
    log('switchWorkspaceContext - reactAgentStates to restore:', Array.from(workspaceState.reactAgentStates.entries()).map(([k, v]) => ({ nodeId: k, steps: v.steps.length, isRunning: v.isRunning })))
    
    set({
      currentWorkspacePath: workspacePath,
      workspaces,
      status: workspaceState.status,
      context: workspaceState.context,
      logs: workspaceState.logs,
      streamingOutput: workspaceState.streamingOutput,
      reactAgentStates: workspaceState.reactAgentStates,
      queueStates: workspaceState.queueStates,
    })
    
    log('switchWorkspaceContext - after switch, global reactAgentStates:', Array.from(get().reactAgentStates.keys()))
  },

  updateNodeStatus: (nodeId, result) => {
    const { context, currentWorkspacePath, workspaces } = get()
    if (!context) return

    const newResults = new Map(context.nodeResults)
    newResults.set(nodeId, result)
    const newContext = { ...context, nodeResults: newResults }

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        newWorkspaces.set(currentWorkspacePath, { ...workspaceState, context: newContext })
      }
      set({ 
        workspaces: newWorkspaces,
        context: newContext 
      })
    } else {
      set({ context: newContext })
    }
  },

  getNodeStatus: (nodeId) => {
    return get().context?.nodeResults.get(nodeId)
  },

  getNodeStatusForWorkspace: (workspacePath, nodeId) => {
    const workspaceState = get().workspaces.get(workspacePath)
    return workspaceState?.context?.nodeResults.get(nodeId)
  },

  appendStreamOutput: (nodeId, chunk) => {
    const { streamingOutput, currentWorkspacePath, workspaces } = get()
    const newMap = new Map(streamingOutput)
    const current = newMap.get(nodeId) || ''
    newMap.set(nodeId, current + chunk)

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        const newStreamingOutput = new Map(workspaceState.streamingOutput)
        newStreamingOutput.set(nodeId, (newStreamingOutput.get(nodeId) || '') + chunk)
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          streamingOutput: newStreamingOutput 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        streamingOutput: newMap 
      })
    } else {
      set({ streamingOutput: newMap })
    }
  },

  getStreamOutput: (nodeId) => {
    return get().streamingOutput.get(nodeId) || ''
  },

  clearStreamOutput: (nodeId) => {
    const { streamingOutput, currentWorkspacePath, workspaces } = get()
    const newMap = new Map(streamingOutput)
    newMap.delete(nodeId)

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        const newStreamingOutput = new Map(workspaceState.streamingOutput)
        newStreamingOutput.delete(nodeId)
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          streamingOutput: newStreamingOutput 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        streamingOutput: newMap 
      })
    } else {
      set({ streamingOutput: newMap })
    }
  },

  addLog: (logEntry) => {
    const { context, logs, currentWorkspacePath, workspaces } = get()
    const newLog: ExecutionLog = {
      ...logEntry,
      id: window.crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      executionId: context?.executionId ?? '',
    }
    const newLogs = [...logs, newLog]

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          logs: [...workspaceState.logs, newLog] 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        logs: newLogs 
      })
    } else {
      set({ logs: newLogs })
    }
  },

  clearLogs: () => {
    const { currentWorkspacePath, workspaces } = get()

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        newWorkspaces.set(currentWorkspacePath, { ...workspaceState, logs: [] })
      }
      set({ 
        workspaces: newWorkspaces,
        logs: [] 
      })
    } else {
      set({ logs: [] })
    }
  },

  setVariable: (key, value) => {
    const { context, currentWorkspacePath, workspaces } = get()
    if (!context) return

    const newContext = {
      ...context,
      variables: { ...context.variables, [key]: value },
    }

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        newWorkspaces.set(currentWorkspacePath, { ...workspaceState, context: newContext })
      }
      set({ 
        workspaces: newWorkspaces,
        context: newContext 
      })
    } else {
      set({ context: newContext })
    }
  },

  getVariable: (key) => {
    return get().context?.variables[key]
  },

  initReActState: (nodeId, maxIterations) => {
    const { reactAgentStates, currentWorkspacePath, workspaces } = get()
    
    log('initReActState', { 
      nodeId, 
      maxIterations, 
      currentWorkspacePath,
      existingGlobalKeys: Array.from(reactAgentStates.keys()),
    })
    
    const newState: ReActExecutionState = {
      nodeId,
      isRunning: true,
      currentIteration: 0,
      maxIterations,
      steps: [],
      finalAnswer: null,
      error: null,
      todos: [],
    }

    const newMap = new Map(reactAgentStates)
    newMap.set(nodeId, newState)

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        const newReactAgentStates = new Map(workspaceState.reactAgentStates)
        newReactAgentStates.set(nodeId, newState)
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          reactAgentStates: newReactAgentStates 
        })
        log('initReActState - saved to workspace:', currentWorkspacePath, 'keys:', Array.from(newReactAgentStates.keys()))
      }
      set({ 
        workspaces: newWorkspaces,
        reactAgentStates: newMap 
      })
    } else {
      log('initReActState - no currentWorkspacePath, only setting global')
      set({ reactAgentStates: newMap })
    }
    
    log('initReActState - after set, global keys:', Array.from(get().reactAgentStates.keys()))
  },

  updateReActStep: (nodeId, stepUpdate) => {
    const { reactAgentStates, currentWorkspacePath, workspaces } = get()
    const state = reactAgentStates.get(nodeId)
    if (!state) {
      log('updateReActStep - NO STATE FOUND for nodeId:', nodeId, 'available keys:', Array.from(reactAgentStates.keys()))
      return
    }

    const newMap = new Map(reactAgentStates)
    const stepIndex = state.steps.findIndex((s) => s.id === stepUpdate.id)

    if (stepIndex >= 0) {
      const newSteps = [...state.steps]
      newSteps[stepIndex] = { ...newSteps[stepIndex], ...stepUpdate }
      newMap.set(nodeId, { ...state, steps: newSteps })
    } else {
      const newStep = stepUpdate as ReActStep
      const newSteps = [...state.steps, newStep]
      newMap.set(nodeId, {
        ...state,
        steps: newSteps,
        currentIteration: newStep.iteration || state.currentIteration,
      })
    }

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          reactAgentStates: new Map(newMap) 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        reactAgentStates: newMap 
      })
    } else {
      set({ reactAgentStates: newMap })
    }
  },

  appendReActThought: (nodeId, chunk) => {
    const { reactAgentStates, currentWorkspacePath, workspaces } = get()
    const state = reactAgentStates.get(nodeId)
    if (!state || state.steps.length === 0) return

    const newMap = new Map(reactAgentStates)
    const lastStep = state.steps[state.steps.length - 1]
    const newSteps = [...state.steps]
    newSteps[newSteps.length - 1] = {
      ...lastStep,
      thought: lastStep.thought + chunk,
      thoughtStreaming: true,
    }
    newMap.set(nodeId, { ...state, steps: newSteps })

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          reactAgentStates: new Map(newMap) 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        reactAgentStates: newMap 
      })
    } else {
      set({ reactAgentStates: newMap })
    }
  },

  appendReActObservation: (nodeId, chunk, isError = false) => {
    const { reactAgentStates, currentWorkspacePath, workspaces } = get()
    const state = reactAgentStates.get(nodeId)
    if (!state || state.steps.length === 0) return

    const newMap = new Map(reactAgentStates)
    const lastStep = state.steps[state.steps.length - 1]
    const newSteps = [...state.steps]
    newSteps[newSteps.length - 1] = {
      ...lastStep,
      observation: (lastStep.observation || '') + chunk,
      observationStreaming: true,
      observationError: isError,
    }
    newMap.set(nodeId, { ...state, steps: newSteps })

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          reactAgentStates: new Map(newMap) 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        reactAgentStates: newMap 
      })
    } else {
      set({ reactAgentStates: newMap })
    }
  },

  setReActFinalAnswer: (nodeId, answer) => {
    const { reactAgentStates, currentWorkspacePath, workspaces } = get()
    const state = reactAgentStates.get(nodeId)
    if (!state) return

    const newMap = new Map(reactAgentStates)
    newMap.set(nodeId, { ...state, finalAnswer: answer })

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          reactAgentStates: new Map(newMap) 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        reactAgentStates: newMap 
      })
    } else {
      set({ reactAgentStates: newMap })
    }
  },

  completeReActStep: (nodeId, stepId) => {
    const { reactAgentStates, currentWorkspacePath, workspaces } = get()
    const state = reactAgentStates.get(nodeId)
    if (!state) return

    const newMap = new Map(reactAgentStates)
    const newSteps = state.steps.map((s) =>
      s.id === stepId
        ? {
            ...s,
            status: 'completed' as const,
            thoughtStreaming: false,
            observationStreaming: false,
            completedAt: Date.now(),
          }
        : s
    )
    newMap.set(nodeId, { ...state, steps: newSteps })

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          reactAgentStates: new Map(newMap) 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        reactAgentStates: newMap 
      })
    } else {
      set({ reactAgentStates: newMap })
    }
  },

  getReActState: (nodeId) => {
    return get().reactAgentStates.get(nodeId)
  },

  getReActStateForWorkspace: (workspacePath: string, nodeId: string) => {
    const workspaceState = get().workspaces.get(workspacePath)
    return workspaceState?.reactAgentStates.get(nodeId)
  },

  clearReActState: (nodeId) => {
    const { reactAgentStates, currentWorkspacePath, workspaces } = get()
    const newMap = new Map(reactAgentStates)
    newMap.delete(nodeId)

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        const workspaceReactStates = new Map(workspaceState.reactAgentStates)
        workspaceReactStates.delete(nodeId)
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          reactAgentStates: workspaceReactStates 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        reactAgentStates: newMap 
      })
    } else {
      set({ reactAgentStates: newMap })
    }
  },

  updateReActTodos: (nodeId, todos) => {
    const { reactAgentStates, currentWorkspacePath, workspaces } = get()
    const state = reactAgentStates.get(nodeId)
    if (!state) return

    const newMap = new Map(reactAgentStates)
    newMap.set(nodeId, { ...state, todos })

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          reactAgentStates: new Map(newMap) 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        reactAgentStates: newMap 
      })
    } else {
      set({ reactAgentStates: newMap })
    }
  },

  getQueue: (nodeId) => {
    return get().queueStates.get(nodeId) || []
  },

  enqueue: (nodeId, item) => {
    const { queueStates, currentWorkspacePath, workspaces } = get()
    const newMap = new Map(queueStates)
    const queue = newMap.get(nodeId) || []
    newMap.set(nodeId, [...queue, item])

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        const workspaceQueueStates = new Map(workspaceState.queueStates)
        workspaceQueueStates.set(nodeId, [...(workspaceQueueStates.get(nodeId) || []), item])
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          queueStates: workspaceQueueStates 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        queueStates: newMap 
      })
    } else {
      set({ queueStates: newMap })
    }
  },

  dequeue: (nodeId) => {
    const { queueStates, currentWorkspacePath, workspaces } = get()
    const queue = queueStates.get(nodeId) || []
    if (queue.length === 0) return undefined
    const [first, ...rest] = queue
    const newMap = new Map(queueStates)
    newMap.set(nodeId, rest)

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        const workspaceQueueStates = new Map(workspaceState.queueStates)
        workspaceQueueStates.set(nodeId, rest)
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          queueStates: workspaceQueueStates 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        queueStates: newMap 
      })
    } else {
      set({ queueStates: newMap })
    }
    return first
  },

  clearQueue: (nodeId) => {
    const { queueStates, currentWorkspacePath, workspaces } = get()
    const newMap = new Map(queueStates)
    newMap.delete(nodeId)

    if (currentWorkspacePath) {
      const newWorkspaces = new Map(workspaces)
      const workspaceState = newWorkspaces.get(currentWorkspacePath)
      if (workspaceState) {
        const workspaceQueueStates = new Map(workspaceState.queueStates)
        workspaceQueueStates.delete(nodeId)
        newWorkspaces.set(currentWorkspacePath, { 
          ...workspaceState, 
          queueStates: workspaceQueueStates 
        })
      }
      set({ 
        workspaces: newWorkspaces,
        queueStates: newMap 
      })
    } else {
      set({ queueStates: newMap })
    }
  },

  startExecutionForWorkspace: (workspacePath, workflowId) => {
    log('startExecutionForWorkspace', { workspacePath, workflowId })
    
    const context: ExecutionContext = {
      workflowId,
      executionId: window.crypto.randomUUID(),
      startTime: new Date().toISOString(),
      nodeResults: new Map(),
      variables: {},
    }

    const workspaces = new Map(get().workspaces)
    const existingWorkspace = workspaces.get(workspacePath)
    
    workspaces.set(workspacePath, {
      status: 'running',
      context,
      logs: existingWorkspace?.logs || [],
      streamingOutput: new Map(),
      reactAgentStates: new Map(),
      queueStates: new Map(),
    })

    set({
      currentWorkspacePath: workspacePath,
      workspaces,
      status: 'running',
      context,
      logs: existingWorkspace?.logs || [],
      streamingOutput: new Map(),
      reactAgentStates: new Map(),
      queueStates: new Map(),
    })
  },

  pauseExecutionForWorkspace: (workspacePath) => {
    const workspaces = new Map(get().workspaces)
    const workspaceState = workspaces.get(workspacePath)
    if (workspaceState) {
      workspaces.set(workspacePath, { ...workspaceState, status: 'paused' })
      set({ workspaces })
    }
  },

  resumeExecutionForWorkspace: (workspacePath) => {
    const workspaces = new Map(get().workspaces)
    const workspaceState = workspaces.get(workspacePath)
    if (workspaceState) {
      workspaces.set(workspacePath, { ...workspaceState, status: 'running' })
      set({ workspaces })
    }
  },

  cancelExecutionForWorkspace: (workspacePath) => {
    const workspaces = new Map(get().workspaces)
    const workspaceState = workspaces.get(workspacePath)
    if (workspaceState) {
      workspaces.set(workspacePath, { 
        ...workspaceState, 
        status: 'cancelled', 
        context: null 
      })
      set({ workspaces })
    }
  },

  completeExecutionForWorkspace: (workspacePath, success) => {
    const workspaces = new Map(get().workspaces)
    const workspaceState = workspaces.get(workspacePath)
    if (workspaceState) {
      workspaces.set(workspacePath, { 
        ...workspaceState, 
        status: success ? 'completed' : 'failed' 
      })
      set({ workspaces })
    }
  },

  getExecutionStatusForWorkspace: (workspacePath) => {
    const workspaceState = get().workspaces.get(workspacePath)
    return workspaceState?.status || 'idle'
  },
}))
