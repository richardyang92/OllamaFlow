import { create } from 'zustand'
import type {
  ExecutionStatus,
  ExecutionContext,
  NodeExecutionResult,
  ExecutionLog,
} from '@/types/execution'
import type { ReActExecutionState, ReActStep, TodoItem } from '@/types/node'

interface ExecutionState {
  status: ExecutionStatus
  context: ExecutionContext | null
  logs: ExecutionLog[]
  streamingOutput: Map<string, string>
  reactAgentStates: Map<string, ReActExecutionState>

  // Actions
  startExecution: (workflowId: string) => void
  pauseExecution: () => void
  resumeExecution: () => void
  cancelExecution: () => void
  completeExecution: (success: boolean) => void

  // Node status
  updateNodeStatus: (nodeId: string, result: NodeExecutionResult) => void
  getNodeStatus: (nodeId: string) => NodeExecutionResult | undefined

  // Streaming
  appendStreamOutput: (nodeId: string, chunk: string) => void
  getStreamOutput: (nodeId: string) => string
  clearStreamOutput: (nodeId: string) => void

  // Logs
  addLog: (log: Omit<ExecutionLog, 'id' | 'timestamp' | 'executionId'>) => void
  clearLogs: () => void

  // Variables
  setVariable: (key: string, value: unknown) => void
  getVariable: (key: string) => unknown

  // ReAct Agent state management
  initReActState: (nodeId: string, maxIterations: number) => void
  updateReActStep: (nodeId: string, step: Partial<ReActStep> & { id: string }) => void
  appendReActThought: (nodeId: string, chunk: string) => void
  appendReActObservation: (nodeId: string, chunk: string, isError?: boolean) => void
  setReActFinalAnswer: (nodeId: string, answer: string) => void
  completeReActStep: (nodeId: string, stepId: string) => void
  getReActState: (nodeId: string) => ReActExecutionState | undefined
  clearReActState: (nodeId: string) => void
  updateReActTodos: (nodeId: string, todos: TodoItem[]) => void
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  status: 'idle',
  context: null,
  logs: [],
  streamingOutput: new Map(),
  reactAgentStates: new Map(),

  startExecution: (workflowId) => {
    const context: ExecutionContext = {
      workflowId,
      executionId: window.crypto.randomUUID(),
      startTime: new Date().toISOString(),
      nodeResults: new Map(),
      variables: {},
    }

    set({
      status: 'running',
      context,
      logs: [],
      streamingOutput: new Map(),
    })

    get().addLog({
      level: 'info',
      message: `Started execution: ${workflowId}`,
    })
  },

  pauseExecution: () => {
    set({ status: 'paused' })
    get().addLog({ level: 'info', message: 'Execution paused' })
  },

  resumeExecution: () => {
    set({ status: 'running' })
    get().addLog({ level: 'info', message: 'Execution resumed' })
  },

  cancelExecution: () => {
    set({ status: 'cancelled', context: null })
    get().addLog({ level: 'warn', message: 'Execution cancelled' })
  },

  completeExecution: (success) => {
    set({
      status: success ? 'completed' : 'failed',
    })
    get().addLog({
      level: success ? 'info' : 'error',
      message: success ? 'Execution completed' : 'Execution failed',
    })
  },

  updateNodeStatus: (nodeId, result) => {
    const { context } = get()
    if (!context) return

    const newResults = new Map(context.nodeResults)
    newResults.set(nodeId, result)

    set({
      context: { ...context, nodeResults: newResults },
    })
  },

  getNodeStatus: (nodeId) => {
    return get().context?.nodeResults.get(nodeId)
  },

  appendStreamOutput: (nodeId, chunk) => {
    const { streamingOutput } = get()
    const newMap = new Map(streamingOutput)
    const current = newMap.get(nodeId) || ''
    newMap.set(nodeId, current + chunk)
    set({ streamingOutput: newMap })
  },

  getStreamOutput: (nodeId) => {
    return get().streamingOutput.get(nodeId) || ''
  },

  clearStreamOutput: (nodeId) => {
    const { streamingOutput } = get()
    const newMap = new Map(streamingOutput)
    newMap.delete(nodeId)
    set({ streamingOutput: newMap })
  },

  addLog: (log) => {
    const { context } = get()
    const newLog: ExecutionLog = {
      ...log,
      id: window.crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      executionId: context?.executionId ?? '',
    }
    set({ logs: [...get().logs, newLog] })
  },

  clearLogs: () => set({ logs: [] }),

  setVariable: (key, value) => {
    const { context } = get()
    if (!context) return
    set({
      context: {
        ...context,
        variables: { ...context.variables, [key]: value },
      },
    })
  },

  getVariable: (key) => {
    return get().context?.variables[key]
  },

  // ReAct Agent state management
  initReActState: (nodeId, maxIterations) => {
    const { reactAgentStates } = get()
    const newMap = new Map(reactAgentStates)
    newMap.set(nodeId, {
      nodeId,
      isRunning: true,
      currentIteration: 0,
      maxIterations,
      steps: [],
      finalAnswer: null,
      error: null,
      todos: [],
    })
    set({ reactAgentStates: newMap })
  },

  updateReActStep: (nodeId, stepUpdate) => {
    const { reactAgentStates } = get()
    const state = reactAgentStates.get(nodeId)
    if (!state) return

    const newMap = new Map(reactAgentStates)
    const stepIndex = state.steps.findIndex((s) => s.id === stepUpdate.id)

    if (stepIndex >= 0) {
      // Update existing step
      const newSteps = [...state.steps]
      newSteps[stepIndex] = { ...newSteps[stepIndex], ...stepUpdate }
      newMap.set(nodeId, { ...state, steps: newSteps })
    } else {
      // Add new step (need full step data)
      const newStep = stepUpdate as ReActStep
      const newSteps = [...state.steps, newStep]
      newMap.set(nodeId, {
        ...state,
        steps: newSteps,
        currentIteration: newStep.iteration || state.currentIteration,
      })
    }
    set({ reactAgentStates: newMap })
  },

  appendReActThought: (nodeId, chunk) => {
    const { reactAgentStates } = get()
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
    set({ reactAgentStates: newMap })
  },

  appendReActObservation: (nodeId, chunk, isError = false) => {
    const { reactAgentStates } = get()
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
    set({ reactAgentStates: newMap })
  },

  setReActFinalAnswer: (nodeId, answer) => {
    const { reactAgentStates } = get()
    const state = reactAgentStates.get(nodeId)
    if (!state) return

    const newMap = new Map(reactAgentStates)
    newMap.set(nodeId, { ...state, finalAnswer: answer })
    set({ reactAgentStates: newMap })
  },

  completeReActStep: (nodeId, stepId) => {
    const { reactAgentStates } = get()
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
    set({ reactAgentStates: newMap })
  },

  getReActState: (nodeId) => {
    return get().reactAgentStates.get(nodeId)
  },

  clearReActState: (nodeId) => {
    const { reactAgentStates } = get()
    const newMap = new Map(reactAgentStates)
    newMap.delete(nodeId)
    set({ reactAgentStates: newMap })
  },

  updateReActTodos: (nodeId, todos) => {
    const { reactAgentStates } = get()
    const state = reactAgentStates.get(nodeId)
    if (!state) return

    const newMap = new Map(reactAgentStates)
    newMap.set(nodeId, { ...state, todos })
    set({ reactAgentStates: newMap })
  },
}))
