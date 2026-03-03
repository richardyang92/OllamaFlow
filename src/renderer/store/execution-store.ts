import { create } from 'zustand'
import type {
  ExecutionStatus,
  ExecutionContext,
  NodeExecutionResult,
  ExecutionLog,
} from '@/types/execution'
import type { ReActExecutionState, ReActStep, TodoItem, PlanExecutionState, PlanQuestion } from '@/types/node'

const DEBUG = true
const log = (...args: unknown[]) => DEBUG && console.log('[ExecutionStore]', ...args)

interface PendingQuestion {
  nodeId: string
  nodeType: 'plan' | 'reactAgent'
  questions?: PlanQuestion[]
  analysis?: string
  prompt?: string
  context?: string
}

interface WorkspaceExecutionState {
  status: ExecutionStatus
  context: ExecutionContext | null
  logs: ExecutionLog[]
  streamingOutput: Map<string, string>
  reactAgentStates: Map<string, ReActExecutionState>
  planStates: Map<string, PlanExecutionState>
  queueStates: Map<string, unknown[]>
  pendingQuestion: PendingQuestion | null
}

interface ExecutionState {
  currentWorkspacePath: string | null
  workspaces: Map<string, WorkspaceExecutionState>

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
  setReActWaitingForInput: (nodeId: string, prompt: string, context?: string) => void

  initPlanState: (nodeId: string) => void
  updatePlanPhase: (nodeId: string, phase: PlanExecutionState['phase'], data?: Partial<PlanExecutionState>) => void
  setPlanQuestions: (nodeId: string, questions: PlanExecutionState['questions'], analysis?: string) => void
  setPlanAnswers: (nodeId: string, answers: Record<string, string>) => void
  setPlanResult: (nodeId: string, plan: string) => void
  setPlanError: (nodeId: string, error: string) => void
  getPlanState: (nodeId: string) => PlanExecutionState | undefined
  getPlanStateForWorkspace: (workspacePath: string, nodeId: string) => PlanExecutionState | undefined
  clearPlanState: (nodeId: string) => void
  clearPendingQuestion: () => void
  getPendingQuestion: () => PendingQuestion | null

  getQueue: (nodeId: string) => unknown[]
  enqueue: (nodeId: string, item: unknown) => void
  dequeue: (nodeId: string) => unknown | undefined
  clearQueue: (nodeId: string) => void
}

// Helper functions to get current workspace state
function getCurrentWorkspaceState(state: ExecutionState): WorkspaceExecutionState | undefined {
  if (!state.currentWorkspacePath) return undefined
  return state.workspaces.get(state.currentWorkspacePath)
}

function getOrCreateWorkspaceState(state: ExecutionState): WorkspaceExecutionState {
  if (!state.currentWorkspacePath) return createEmptyWorkspaceState()
  let workspaceState = state.workspaces.get(state.currentWorkspacePath)
  if (!workspaceState) {
    workspaceState = createEmptyWorkspaceState()
    state.workspaces.set(state.currentWorkspacePath, workspaceState)
  }
  return workspaceState
}

const createEmptyWorkspaceState = (): WorkspaceExecutionState => ({
  status: 'idle',
  context: null,
  logs: [],
  streamingOutput: new Map(),
  reactAgentStates: new Map(),
  planStates: new Map(),
  queueStates: new Map(),
  pendingQuestion: null,
})

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  currentWorkspacePath: null,
  workspaces: new Map(),

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
      planStates: new Map(),
      queueStates: new Map(),
      pendingQuestion: null,
    })

    log('startExecution - workspaces after set:', Array.from(workspaces.keys()))
    log('startExecution - setting current workspace:', workspacePath)

    set({
      currentWorkspacePath: workspacePath,
      workspaces,
    })

    // Log is added to workspace via addLog which uses currentWorkspacePath
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
    })
    get().addLog({
      level: success ? 'info' : 'error',
      message: success ? 'Execution completed' : 'Execution failed',
    })
  },

  resetExecution: () => {
    const { currentWorkspacePath, workspaces } = get()
    log('resetExecution', { currentWorkspacePath })

    // resetExecution is now a no-op for global state
    // Use resetWorkspaceExecution to clear a specific workspace's state
    log('resetExecution - no-op, preserved workspaces:', Array.from(workspaces.keys()))
  },

  resetWorkspaceExecution: (workspacePath: string) => {
    log('resetWorkspaceExecution', { workspacePath })

    const workspaces = new Map(get().workspaces)
    workspaces.set(workspacePath, createEmptyWorkspaceState())

    set({ workspaces })
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

    // Only switch currentWorkspacePath, don't copy state to global
    // This allows background executions to continue
    set({
      currentWorkspacePath: workspacePath,
      workspaces,
    })

    log('switchWorkspaceContext - switched to workspace:', workspacePath)
  },

  updateNodeStatus: (nodeId, result) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState?.context) return

    const newResults = new Map(workspaceState.context.nodeResults)
    newResults.set(nodeId, result)
    const newContext = { ...workspaceState.context, nodeResults: newResults }

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, { ...workspaceState, context: newContext })

    set({ workspaces: newWorkspaces })
  },

  getNodeStatus: (nodeId) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return undefined
    const workspaceState = workspaces.get(currentWorkspacePath)
    return workspaceState?.context?.nodeResults.get(nodeId)
  },

  getNodeStatusForWorkspace: (workspacePath, nodeId) => {
    const workspaceState = get().workspaces.get(workspacePath)
    return workspaceState?.context?.nodeResults.get(nodeId)
  },

  appendStreamOutput: (nodeId, chunk) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const newStreamingOutput = new Map(workspaceState.streamingOutput)
    const current = newStreamingOutput.get(nodeId) || ''
    newStreamingOutput.set(nodeId, current + chunk)

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      streamingOutput: newStreamingOutput
    })

    set({ workspaces: newWorkspaces })
  },

  getStreamOutput: (nodeId) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return ''
    const workspaceState = workspaces.get(currentWorkspacePath)
    return workspaceState?.streamingOutput.get(nodeId) || ''
  },

  clearStreamOutput: (nodeId) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const newStreamingOutput = new Map(workspaceState.streamingOutput)
    newStreamingOutput.delete(nodeId)

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      streamingOutput: newStreamingOutput
    })

    set({ workspaces: newWorkspaces })
  },

  addLog: (logEntry) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const newLog: ExecutionLog = {
      ...logEntry,
      id: window.crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      executionId: workspaceState.context?.executionId ?? '',
    }

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      logs: [...workspaceState.logs, newLog]
    })

    set({ workspaces: newWorkspaces })
  },

  clearLogs: () => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, { ...workspaceState, logs: [] })

    set({ workspaces: newWorkspaces })
  },

  setVariable: (key, value) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState?.context) return

    const newContext = {
      ...workspaceState.context,
      variables: { ...workspaceState.context.variables, [key]: value },
    }

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, { ...workspaceState, context: newContext })

    set({ workspaces: newWorkspaces })
  },

  getVariable: (key) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return undefined
    const workspaceState = workspaces.get(currentWorkspacePath)
    return workspaceState?.context?.variables[key]
  },

  initReActState: (nodeId, maxIterations) => {
    const { currentWorkspacePath, workspaces } = get()

    log('initReActState', {
      nodeId,
      maxIterations,
      currentWorkspacePath,
      existingKeys: workspaces.get(currentWorkspacePath || '')?.reactAgentStates
        ? Array.from(workspaces.get(currentWorkspacePath || '')!.reactAgentStates.keys())
        : [],
    })

    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

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

    const newReactAgentStates = new Map(workspaceState.reactAgentStates)
    newReactAgentStates.set(nodeId, newState)

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      reactAgentStates: newReactAgentStates
    })

    log('initReActState - saved to workspace:', currentWorkspacePath, 'keys:', Array.from(newReactAgentStates.keys()))

    set({ workspaces: newWorkspaces })

    log('initReActState - after set, workspace keys:', Array.from(newReactAgentStates.keys()))
  },

  updateReActStep: (nodeId, stepUpdate) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) {
      log('updateReActStep - NO STATE FOUND for nodeId:', nodeId)
      return
    }

    const state = workspaceState.reactAgentStates.get(nodeId)
    if (!state) {
      log('updateReActStep - NO REACT STATE FOUND for nodeId:', nodeId, 'available keys:', Array.from(workspaceState.reactAgentStates.keys()))
      return
    }

    const newReactAgentStates = new Map(workspaceState.reactAgentStates)
    const stepIndex = state.steps.findIndex((s: ReActStep) => s.id === stepUpdate.id)

    if (stepIndex >= 0) {
      const newSteps = [...state.steps]
      newSteps[stepIndex] = { ...newSteps[stepIndex], ...stepUpdate }
      newReactAgentStates.set(nodeId, { ...state, steps: newSteps })
    } else {
      const newStep = stepUpdate as ReActStep
      const newSteps = [...state.steps, newStep]
      newReactAgentStates.set(nodeId, {
        ...state,
        steps: newSteps,
        currentIteration: newStep.iteration || state.currentIteration,
      })
    }

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      reactAgentStates: newReactAgentStates
    })

    set({ workspaces: newWorkspaces })
  },

  appendReActThought: (nodeId, chunk) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const state = workspaceState.reactAgentStates.get(nodeId)
    if (!state || state.steps.length === 0) return

    const newReactAgentStates = new Map(workspaceState.reactAgentStates)
    const lastStep = state.steps[state.steps.length - 1]
    const newSteps = [...state.steps]
    newSteps[newSteps.length - 1] = {
      ...lastStep,
      thought: lastStep.thought + chunk,
      thoughtStreaming: true,
    }
    newReactAgentStates.set(nodeId, { ...state, steps: newSteps })

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      reactAgentStates: newReactAgentStates
    })

    set({ workspaces: newWorkspaces })
  },

  appendReActObservation: (nodeId, chunk, isError = false) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const state = workspaceState.reactAgentStates.get(nodeId)
    if (!state || state.steps.length === 0) return

    const newReactAgentStates = new Map(workspaceState.reactAgentStates)
    const lastStep = state.steps[state.steps.length - 1]
    const newSteps = [...state.steps]
    newSteps[newSteps.length - 1] = {
      ...lastStep,
      observation: (lastStep.observation || '') + chunk,
      observationStreaming: true,
      observationError: isError,
    }
    newReactAgentStates.set(nodeId, { ...state, steps: newSteps })

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      reactAgentStates: newReactAgentStates
    })

    set({ workspaces: newWorkspaces })
  },

  setReActFinalAnswer: (nodeId, answer) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const state = workspaceState.reactAgentStates.get(nodeId)
    if (!state) return

    const newReactAgentStates = new Map(workspaceState.reactAgentStates)
    newReactAgentStates.set(nodeId, { ...state, finalAnswer: answer })

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      reactAgentStates: newReactAgentStates
    })

    set({ workspaces: newWorkspaces })
  },

  completeReActStep: (nodeId, stepId) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const state = workspaceState.reactAgentStates.get(nodeId)
    if (!state) return

    const newReactAgentStates = new Map(workspaceState.reactAgentStates)
    const newSteps = state.steps.map((s: ReActStep) =>
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
    newReactAgentStates.set(nodeId, { ...state, steps: newSteps })

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      reactAgentStates: newReactAgentStates
    })

    set({ workspaces: newWorkspaces })
  },

  getReActState: (nodeId) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return undefined
    const workspaceState = workspaces.get(currentWorkspacePath)
    return workspaceState?.reactAgentStates.get(nodeId)
  },

  getReActStateForWorkspace: (workspacePath: string, nodeId: string) => {
    const workspaceState = get().workspaces.get(workspacePath)
    return workspaceState?.reactAgentStates.get(nodeId)
  },

  clearReActState: (nodeId) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const newReactAgentStates = new Map(workspaceState.reactAgentStates)
    newReactAgentStates.delete(nodeId)

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      reactAgentStates: newReactAgentStates
    })

    set({ workspaces: newWorkspaces })
  },

  updateReActTodos: (nodeId, todos) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const state = workspaceState.reactAgentStates.get(nodeId)
    if (!state) return

    const newReactAgentStates = new Map(workspaceState.reactAgentStates)
    newReactAgentStates.set(nodeId, { ...state, todos })

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      reactAgentStates: newReactAgentStates
    })

    set({ workspaces: newWorkspaces })
  },

  setReActWaitingForInput: (nodeId, prompt, context) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const pendingQuestion: PendingQuestion = {
      nodeId,
      nodeType: 'reactAgent',
      prompt,
      context,
    }

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      pendingQuestion
    })

    set({ workspaces: newWorkspaces })
  },

  getQueue: (nodeId) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return []
    const workspaceState = workspaces.get(currentWorkspacePath)
    return workspaceState?.queueStates.get(nodeId) || []
  },

  enqueue: (nodeId, item) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const newQueueStates = new Map(workspaceState.queueStates)
    const queue = newQueueStates.get(nodeId) || []
    newQueueStates.set(nodeId, [...queue, item])

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      queueStates: newQueueStates
    })

    set({ workspaces: newWorkspaces })
  },

  dequeue: (nodeId) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return undefined

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return undefined

    const queue = workspaceState.queueStates.get(nodeId) || []
    if (queue.length === 0) return undefined

    const [first, ...rest] = queue
    const newQueueStates = new Map(workspaceState.queueStates)
    newQueueStates.set(nodeId, rest)

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      queueStates: newQueueStates
    })

    set({ workspaces: newWorkspaces })
    return first
  },

  clearQueue: (nodeId) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const newQueueStates = new Map(workspaceState.queueStates)
    newQueueStates.delete(nodeId)

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      queueStates: newQueueStates
    })

    set({ workspaces: newWorkspaces })
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
      planStates: new Map(),
      queueStates: new Map(),
      pendingQuestion: null,
    })

    set({
      currentWorkspacePath: workspacePath,
      workspaces,
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

  initPlanState: (nodeId) => {
    const { currentWorkspacePath, workspaces } = get()

    log('initPlanState', {
      nodeId,
      currentWorkspacePath,
      existingKeys: workspaces.get(currentWorkspacePath || '')?.planStates
        ? Array.from(workspaces.get(currentWorkspacePath || '')!.planStates.keys())
        : [],
    })

    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const newState: PlanExecutionState = {
      nodeId,
      phase: 'analyzing',
    }

    const newPlanStates = new Map(workspaceState.planStates)
    newPlanStates.set(nodeId, newState)

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      planStates: newPlanStates
    })

    log('initPlanState - saved to workspace:', currentWorkspacePath, 'keys:', Array.from(newPlanStates.keys()))

    set({ workspaces: newWorkspaces })

    log('initPlanState - after set, workspace keys:', Array.from(newPlanStates.keys()))
  },

  updatePlanPhase: (nodeId, phase, data) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) {
      log('updatePlanPhase - NO STATE FOUND for nodeId:', nodeId)
      return
    }

    const state = workspaceState.planStates.get(nodeId)
    if (!state) {
      log('updatePlanPhase - NO PLAN STATE FOUND for nodeId:', nodeId, 'available keys:', Array.from(workspaceState.planStates.keys()))
      return
    }

    const newPlanStates = new Map(workspaceState.planStates)
    const updatedState = { ...state, phase, ...data }
    newPlanStates.set(nodeId, updatedState)

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      planStates: newPlanStates
    })

    set({ workspaces: newWorkspaces })
  },

  setPlanQuestions: (nodeId, questions, analysis) => {
    get().updatePlanPhase(nodeId, 'questions', { questions })

    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const pendingQuestion: PendingQuestion = {
      nodeId,
      nodeType: 'plan',
      questions: questions || [],
      analysis: analysis || '',
    }

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      pendingQuestion
    })

    set({ workspaces: newWorkspaces })
  },

  setPlanAnswers: (nodeId, answers) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const state = workspaceState.planStates.get(nodeId)
    if (!state) return

    get().updatePlanPhase(nodeId, 'generating', { answers })
  },

  setPlanResult: (nodeId, plan) => {
    get().updatePlanPhase(nodeId, 'complete', { generatedPlan: plan })
  },

  setPlanError: (nodeId, error) => {
    get().updatePlanPhase(nodeId, 'error', { error })
  },

  getPlanState: (nodeId) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return undefined
    const workspaceState = workspaces.get(currentWorkspacePath)
    return workspaceState?.planStates.get(nodeId)
  },

  getPlanStateForWorkspace: (workspacePath, nodeId) => {
    const workspaceState = get().workspaces.get(workspacePath)
    return workspaceState?.planStates.get(nodeId)
  },

  clearPlanState: (nodeId) => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const newPlanStates = new Map(workspaceState.planStates)
    newPlanStates.delete(nodeId)

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      planStates: newPlanStates
    })

    set({ workspaces: newWorkspaces })
  },

  clearPendingQuestion: () => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return

    const workspaceState = workspaces.get(currentWorkspacePath)
    if (!workspaceState) return

    const newWorkspaces = new Map(workspaces)
    newWorkspaces.set(currentWorkspacePath, {
      ...workspaceState,
      pendingQuestion: null
    })

    set({ workspaces: newWorkspaces })
  },

  getPendingQuestion: () => {
    const { currentWorkspacePath, workspaces } = get()
    if (!currentWorkspacePath) return null
    const workspaceState = workspaces.get(currentWorkspacePath)
    return workspaceState?.pendingQuestion || null
  },
}))
