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
  executionId: string // Store executionId to ensure correct execution is updated
  nodeId: string
  nodeType: 'plan' | 'reactAgent'
  questions?: PlanQuestion[]
  analysis?: string
  prompt?: string
  context?: string
}

interface ExecutionInstanceState {
  executionId: string
  workspacePath: string
  workflowId: string
  status: ExecutionStatus
  context: ExecutionContext | null
  logs: ExecutionLog[]
  streamingOutput: Map<string, string>
  reactAgentStates: Map<string, ReActExecutionState>
  planStates: Map<string, PlanExecutionState>
  queueStates: Map<string, unknown[]>
  activeBranches: Map<string, string[]>
  pendingQuestion: PendingQuestion | null
  createdAt: number // Timestamp for stable sorting
}

interface ExecutionState {
  executions: Map<string, ExecutionInstanceState>
  workspaceExecutions: Map<string, Set<string>>

  createExecution: (workspacePath: string, workflowId: string) => string
  getExecution: (executionId: string) => ExecutionInstanceState | undefined
  listExecutions: (workspacePath?: string) => string[]
  deleteExecution: (executionId: string) => void
  getCurrentWorkspaceExecutions: (workspacePath: string) => ExecutionInstanceState[]
  getActiveExecution: (workspacePath: string) => string | undefined

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
  getLogsForWorkspace: (workspacePath: string) => ExecutionLog[]
  getPendingQuestionForWorkspace: (workspacePath: string) => PendingQuestion | null
  getExecutionContextForWorkspace: (workspacePath: string) => ExecutionContext | null
  getNodeResultsForWorkspace: (workspacePath: string) => Map<string, NodeExecutionResult> | undefined
  clearLogsForWorkspace: (workspacePath: string) => void
  getStreamOutputForWorkspace: (workspacePath: string, nodeId: string) => string

  updateNodeStatus: (executionId: string, nodeId: string, result: NodeExecutionResult) => void
  getNodeStatus: (executionId: string, nodeId: string) => NodeExecutionResult | undefined
  getNodeStatusForWorkspace: (workspacePath: string, nodeId: string) => NodeExecutionResult | undefined

  appendStreamOutput: (executionId: string, nodeId: string, chunk: string) => void
  getStreamOutput: (executionId: string, nodeId: string) => string
  clearStreamOutput: (executionId: string, nodeId: string) => void

  addLog: (executionId: string, log: Omit<ExecutionLog, 'id' | 'timestamp' | 'executionId'>) => void
  clearLogs: (executionId: string) => void

  setVariable: (executionId: string, key: string, value: unknown) => void
  getVariable: (executionId: string, key: string) => unknown

  setActiveBranches: (executionId: string, nodeId: string, branches: string[]) => void
  getActiveBranches: (executionId: string, nodeId: string) => string[] | undefined

  initReActState: (executionId: string, nodeId: string, maxIterations: number) => void
  updateReActStep: (executionId: string, nodeId: string, step: Partial<ReActStep> & { id: string }) => void
  appendReActThought: (executionId: string, nodeId: string, chunk: string) => void
  appendReActObservation: (executionId: string, nodeId: string, chunk: string, isError?: boolean) => void
  setReActFinalAnswer: (executionId: string, nodeId: string, answer: string) => void
  completeReActStep: (executionId: string, nodeId: string, stepId: string) => void
  getReActState: (executionId: string, nodeId: string) => ReActExecutionState | undefined
  getReActStateForWorkspace: (workspacePath: string, nodeId: string) => ReActExecutionState | undefined
  clearReActState: (executionId: string, nodeId: string) => void
  updateReActTodos: (executionId: string, nodeId: string, todos: TodoItem[]) => void
  setReActWaitingForInput: (executionId: string, nodeId: string, prompt: string, context?: string) => void

  initPlanState: (executionId: string, nodeId: string) => void
  updatePlanPhase: (executionId: string, nodeId: string, phase: PlanExecutionState['phase'], data?: Partial<PlanExecutionState>) => void
  setPlanQuestions: (executionId: string, nodeId: string, questions: PlanExecutionState['questions'], analysis?: string) => void
  setPlanAnswers: (executionId: string, nodeId: string, answers: Record<string, string>) => void
  setPlanResult: (executionId: string, nodeId: string, plan: string) => void
  setPlanError: (executionId: string, nodeId: string, error: string) => void
  getPlanState: (executionId: string, nodeId: string) => PlanExecutionState | undefined
  getPlanStateForWorkspace: (workspacePath: string, nodeId: string) => PlanExecutionState | undefined
  clearPlanState: (executionId: string, nodeId: string) => void
  clearPendingQuestion: (executionId: string) => void
  getPendingQuestion: (executionId: string) => PendingQuestion | null

  getQueue: (executionId: string, nodeId: string) => unknown[]
  enqueue: (executionId: string, nodeId: string, item: unknown) => void
  dequeue: (executionId: string, nodeId: string) => unknown | undefined
  clearQueue: (executionId: string, nodeId: string) => void
}

const createEmptyExecutionState = (executionId: string, workspacePath: string, workflowId: string): ExecutionInstanceState => ({
  executionId,
  workspacePath,
  workflowId,
  status: 'idle',
  context: null,
  logs: [],
  streamingOutput: new Map(),
  reactAgentStates: new Map(),
  planStates: new Map(),
  queueStates: new Map(),
  activeBranches: new Map(),
  pendingQuestion: null,
  createdAt: Date.now(),
})

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  executions: new Map(),
  workspaceExecutions: new Map(),

  // Execution instance lifecycle management
  createExecution: (workspacePath, workflowId) => {
    const executionId = window.crypto.randomUUID()
    log('createExecution', { executionId, workspacePath, workflowId })

    const context: ExecutionContext = {
      workflowId,
      executionId,
      startTime: new Date().toISOString(),
      nodeResults: new Map(),
      variables: {},
    }

    const executionState = createEmptyExecutionState(executionId, workspacePath, workflowId)
    executionState.status = 'running'
    executionState.context = context

    const executions = new Map(get().executions)
    executions.set(executionId, executionState)

    const workspaceExecutions = new Map(get().workspaceExecutions)
    const workspaceExecSet = workspaceExecutions.get(workspacePath) || new Set()
    workspaceExecSet.add(executionId)
    workspaceExecutions.set(workspacePath, workspaceExecSet)

    set({ executions, workspaceExecutions })

    log('createExecution - created:', executionId, 'for workspace:', workspacePath)
    return executionId
  },

  getExecution: (executionId) => {
    return get().executions.get(executionId)
  },

  listExecutions: (workspacePath) => {
    if (workspacePath) {
      const workspaceExecSet = get().workspaceExecutions.get(workspacePath)
      return workspaceExecSet ? Array.from(workspaceExecSet) : []
    }
    return Array.from(get().executions.keys())
  },

  deleteExecution: (executionId) => {
    log('deleteExecution', { executionId })

    const execution = get().executions.get(executionId)
    if (!execution) return

    const executions = new Map(get().executions)
    executions.delete(executionId)

    const workspaceExecutions = new Map(get().workspaceExecutions)
    const workspaceExecSet = workspaceExecutions.get(execution.workspacePath)
    if (workspaceExecSet) {
      workspaceExecSet.delete(executionId)
      if (workspaceExecSet.size === 0) {
        workspaceExecutions.delete(execution.workspacePath)
      } else {
        workspaceExecutions.set(execution.workspacePath, workspaceExecSet)
      }
    }

    set({ executions, workspaceExecutions })
    log('deleteExecution - deleted:', executionId)
  },

  getCurrentWorkspaceExecutions: (workspacePath) => {
    const workspaceExecSet = get().workspaceExecutions.get(workspacePath)
    if (!workspaceExecSet) return []

    const executions = get().executions
    return Array.from(workspaceExecSet)
      .map(id => executions.get(id))
      .filter((exec): exec is ExecutionInstanceState => exec !== undefined)
  },

  getActiveExecution: (workspacePath) => {
    const workspaceExecs = get().getCurrentWorkspaceExecutions(workspacePath)
    if (workspaceExecs.length === 0) return undefined

    // Sort by createdAt descending (most recent first)
    const sortedExecs = [...workspaceExecs].sort((a, b) => b.createdAt - a.createdAt)

    // Priority: running > paused > others (most recent)
    const runningExec = sortedExecs.find(exec => exec.status === 'running')
    if (runningExec) return runningExec.executionId

    const pausedExec = sortedExecs.find(exec => exec.status === 'paused')
    if (pausedExec) return pausedExec.executionId

    // Return most recent execution (first in sorted array)
    return sortedExecs[0].executionId
  },

  // Legacy methods for backward compatibility - these use the active execution for the workspace
  startExecution: (workspacePath, workflowId) => {
    log('startExecution (legacy)', { workspacePath, workflowId })
    const executionId = get().createExecution(workspacePath, workflowId)
    get().addLog(executionId, {
      level: 'info',
      message: `Started execution: ${workflowId}`,
    })
    return executionId
  },

  pauseExecution: () => {
    log('pauseExecution (legacy) - deprecated, use pauseExecutionForWorkspace')
  },

  resumeExecution: () => {
    log('resumeExecution (legacy) - deprecated, use resumeExecutionForWorkspace')
  },

  cancelExecution: () => {
    log('cancelExecution (legacy) - deprecated, use cancelExecutionForWorkspace')
  },

  completeExecution: (success) => {
    log('completeExecution (legacy) - deprecated, use completeExecutionForWorkspace', { success })
  },

  resetExecution: () => {
    log('resetExecution (legacy) - no-op')
  },

  resetWorkspaceExecution: (workspacePath: string) => {
    log('resetWorkspaceExecution', { workspacePath })
    const executionIds = get().listExecutions(workspacePath)
    executionIds.forEach(id => get().deleteExecution(id))
  },

  switchWorkspaceContext: (workspacePath: string) => {
    log('switchWorkspaceContext (legacy)', { workspacePath })
    // This is now a no-op since we don't have currentWorkspacePath
    // UI components should track their own active executionId
  },

  // Node status operations
  updateNodeStatus: (executionId, nodeId, result) => {
    log('updateNodeStatus', { executionId, nodeId, result: { ...result, input: '...', output: '...' } })
    const execution = get().executions.get(executionId)
    if (!execution?.context) {
      log('updateNodeStatus - NO EXECUTION OR CONTEXT FOUND for executionId:', executionId)
      return
    }

    const newResults = new Map(execution.context.nodeResults)
    newResults.set(nodeId, result)
    const newContext = { ...execution.context, nodeResults: newResults }

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, context: newContext })

    set({ executions })
    log('updateNodeStatus - updated, new size:', newResults.size)
  },

  getNodeStatus: (executionId, nodeId) => {
    const execution = get().executions.get(executionId)
    return execution?.context?.nodeResults.get(nodeId)
  },

  getNodeStatusForWorkspace: (workspacePath, nodeId) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return undefined
    return get().getNodeStatus(activeExecutionId, nodeId)
  },

  // Stream output operations
  appendStreamOutput: (executionId, nodeId, chunk) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const newStreamingOutput = new Map(execution.streamingOutput)
    const current = newStreamingOutput.get(nodeId) || ''
    newStreamingOutput.set(nodeId, current + chunk)

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, streamingOutput: newStreamingOutput })

    set({ executions })
  },

  getStreamOutput: (executionId, nodeId) => {
    const execution = get().executions.get(executionId)
    return execution?.streamingOutput.get(nodeId) || ''
  },

  clearStreamOutput: (executionId, nodeId) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const newStreamingOutput = new Map(execution.streamingOutput)
    newStreamingOutput.delete(nodeId)

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, streamingOutput: newStreamingOutput })

    set({ executions })
  },

  // Log operations
  addLog: (executionId, logEntry) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const newLog: ExecutionLog = {
      ...logEntry,
      id: window.crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      executionId: execution.context?.executionId ?? executionId,
    }

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, logs: [...execution.logs, newLog] })

    set({ executions })
  },

  clearLogs: (executionId) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, logs: [] })

    set({ executions })
  },

  // Variable operations
  setVariable: (executionId, key, value) => {
    const execution = get().executions.get(executionId)
    if (!execution?.context) return

    const newContext = {
      ...execution.context,
      variables: { ...execution.context.variables, [key]: value },
    }

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, context: newContext })

    set({ executions })
  },

  getVariable: (executionId, key) => {
    const execution = get().executions.get(executionId)
    return execution?.context?.variables[key]
  },

  // Active branches operations
  setActiveBranches: (executionId, nodeId, branches) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const newActiveBranches = new Map(execution.activeBranches)
    newActiveBranches.set(nodeId, branches)

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, activeBranches: newActiveBranches })

    set({ executions })
  },

  getActiveBranches: (executionId, nodeId) => {
    const execution = get().executions.get(executionId)
    return execution?.activeBranches.get(nodeId)
  },

  // ReAct state operations
  initReActState: (executionId, nodeId, maxIterations) => {
    log('initReActState', { executionId, nodeId, maxIterations })

    const execution = get().executions.get(executionId)
    if (!execution) return

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

    const newReactAgentStates = new Map(execution.reactAgentStates)
    newReactAgentStates.set(nodeId, newState)

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, reactAgentStates: newReactAgentStates })

    set({ executions })
    log('initReActState - saved for execution:', executionId)
  },

  updateReActStep: (executionId, nodeId, stepUpdate) => {
    const execution = get().executions.get(executionId)
    if (!execution) {
      log('updateReActStep - NO EXECUTION FOUND for executionId:', executionId)
      return
    }

    const state = execution.reactAgentStates.get(nodeId)
    if (!state) {
      log('updateReActStep - NO REACT STATE FOUND for nodeId:', nodeId)
      return
    }

    const newReactAgentStates = new Map(execution.reactAgentStates)
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

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, reactAgentStates: newReactAgentStates })

    set({ executions })
  },

  appendReActThought: (executionId, nodeId, chunk) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const state = execution.reactAgentStates.get(nodeId)
    if (!state || state.steps.length === 0) return

    const newReactAgentStates = new Map(execution.reactAgentStates)
    const lastStep = state.steps[state.steps.length - 1]
    const newSteps = [...state.steps]
    newSteps[newSteps.length - 1] = {
      ...lastStep,
      thought: lastStep.thought + chunk,
      thoughtStreaming: true,
    }
    newReactAgentStates.set(nodeId, { ...state, steps: newSteps })

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, reactAgentStates: newReactAgentStates })

    set({ executions })
  },

  appendReActObservation: (executionId, nodeId, chunk, isError = false) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const state = execution.reactAgentStates.get(nodeId)
    if (!state || state.steps.length === 0) return

    const newReactAgentStates = new Map(execution.reactAgentStates)
    const lastStep = state.steps[state.steps.length - 1]
    const newSteps = [...state.steps]
    newSteps[newSteps.length - 1] = {
      ...lastStep,
      observation: (lastStep.observation || '') + chunk,
      observationStreaming: true,
      observationError: isError,
    }
    newReactAgentStates.set(nodeId, { ...state, steps: newSteps })

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, reactAgentStates: newReactAgentStates })

    set({ executions })
  },

  setReActFinalAnswer: (executionId, nodeId, answer) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const state = execution.reactAgentStates.get(nodeId)
    if (!state) return

    const newReactAgentStates = new Map(execution.reactAgentStates)
    newReactAgentStates.set(nodeId, { ...state, finalAnswer: answer })

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, reactAgentStates: newReactAgentStates })

    set({ executions })
  },

  completeReActStep: (executionId, nodeId, stepId) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const state = execution.reactAgentStates.get(nodeId)
    if (!state) return

    const newReactAgentStates = new Map(execution.reactAgentStates)
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

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, reactAgentStates: newReactAgentStates })

    set({ executions })
  },

  getReActState: (executionId, nodeId) => {
    const execution = get().executions.get(executionId)
    return execution?.reactAgentStates.get(nodeId)
  },

  getReActStateForWorkspace: (workspacePath: string, nodeId: string) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return undefined
    return get().getReActState(activeExecutionId, nodeId)
  },

  clearReActState: (executionId, nodeId) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const newReactAgentStates = new Map(execution.reactAgentStates)
    newReactAgentStates.delete(nodeId)

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, reactAgentStates: newReactAgentStates })

    set({ executions })
  },

  updateReActTodos: (executionId, nodeId, todos) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const state = execution.reactAgentStates.get(nodeId)
    if (!state) return

    const newReactAgentStates = new Map(execution.reactAgentStates)
    newReactAgentStates.set(nodeId, { ...state, todos })

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, reactAgentStates: newReactAgentStates })

    set({ executions })
  },

  setReActWaitingForInput: (executionId, nodeId, prompt, context) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const pendingQuestion: PendingQuestion = {
      executionId,
      nodeId,
      nodeType: 'reactAgent',
      prompt,
      context,
    }

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, pendingQuestion })

    set({ executions })
  },

  // Queue operations
  getQueue: (executionId, nodeId) => {
    const execution = get().executions.get(executionId)
    return execution?.queueStates.get(nodeId) || []
  },

  enqueue: (executionId, nodeId, item) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const newQueueStates = new Map(execution.queueStates)
    const queue = newQueueStates.get(nodeId) || []
    newQueueStates.set(nodeId, [...queue, item])

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, queueStates: newQueueStates })

    set({ executions })
  },

  dequeue: (executionId, nodeId) => {
    const execution = get().executions.get(executionId)
    if (!execution) return undefined

    const queue = execution.queueStates.get(nodeId) || []
    if (queue.length === 0) return undefined

    const [first, ...rest] = queue
    const newQueueStates = new Map(execution.queueStates)
    newQueueStates.set(nodeId, rest)

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, queueStates: newQueueStates })

    set({ executions })
    return first
  },

  clearQueue: (executionId, nodeId) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const newQueueStates = new Map(execution.queueStates)
    newQueueStates.delete(nodeId)

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, queueStates: newQueueStates })

    set({ executions })
  },

  // Workspace-specific execution methods (for backward compatibility)
  startExecutionForWorkspace: (workspacePath, workflowId) => {
    log('startExecutionForWorkspace', { workspacePath, workflowId })
    return get().createExecution(workspacePath, workflowId)
  },

  pauseExecutionForWorkspace: (workspacePath) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return

    const execution = get().executions.get(activeExecutionId)
    if (!execution) return

    const executions = new Map(get().executions)
    executions.set(activeExecutionId, { ...execution, status: 'paused' })
    set({ executions })
  },

  resumeExecutionForWorkspace: (workspacePath) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return

    const execution = get().executions.get(activeExecutionId)
    if (!execution) return

    const executions = new Map(get().executions)
    executions.set(activeExecutionId, { ...execution, status: 'running' })
    set({ executions })
  },

  cancelExecutionForWorkspace: (workspacePath) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return

    const execution = get().executions.get(activeExecutionId)
    if (!execution) return

    const executions = new Map(get().executions)
    executions.set(activeExecutionId, { ...execution, status: 'cancelled', context: null })
    set({ executions })
  },

  completeExecutionForWorkspace: (workspacePath, success) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return

    const execution = get().executions.get(activeExecutionId)
    if (!execution) return

    const executions = new Map(get().executions)
    executions.set(activeExecutionId, { 
      ...execution, 
      status: success ? 'completed' : 'failed' 
    })
    set({ executions })
  },

  getExecutionStatusForWorkspace: (workspacePath) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return 'idle'
    const execution = get().executions.get(activeExecutionId)
    return execution?.status || 'idle'
  },

  getLogsForWorkspace: (workspacePath) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return []
    const execution = get().executions.get(activeExecutionId)
    return execution?.logs || []
  },

  getPendingQuestionForWorkspace: (workspacePath) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return null
    const execution = get().executions.get(activeExecutionId)
    return execution?.pendingQuestion || null
  },

  getExecutionContextForWorkspace: (workspacePath) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return null
    const execution = get().executions.get(activeExecutionId)
    return execution?.context || null
  },

  getNodeResultsForWorkspace: (workspacePath) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return undefined
    const execution = get().executions.get(activeExecutionId)
    return execution?.context?.nodeResults
  },

  clearLogsForWorkspace: (workspacePath) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return
    get().clearLogs(activeExecutionId)
  },

  getStreamOutputForWorkspace: (workspacePath, nodeId) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return ''
    return get().getStreamOutput(activeExecutionId, nodeId)
  },

  // Plan state operations
  initPlanState: (executionId, nodeId) => {
    log('initPlanState', { executionId, nodeId })

    const execution = get().executions.get(executionId)
    if (!execution) return

    const newState: PlanExecutionState = {
      nodeId,
      phase: 'analyzing',
    }

    const newPlanStates = new Map(execution.planStates)
    newPlanStates.set(nodeId, newState)

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, planStates: newPlanStates })

    set({ executions })
    log('initPlanState - saved for execution:', executionId)
  },

  updatePlanPhase: (executionId, nodeId, phase, data) => {
    const execution = get().executions.get(executionId)
    if (!execution) {
      log('updatePlanPhase - NO EXECUTION FOUND for executionId:', executionId)
      return
    }

    const state = execution.planStates.get(nodeId)
    if (!state) {
      log('updatePlanPhase - NO PLAN STATE FOUND for nodeId:', nodeId)
      return
    }

    const newPlanStates = new Map(execution.planStates)
    const updatedState = { ...state, phase, ...data }
    newPlanStates.set(nodeId, updatedState)

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, planStates: newPlanStates })

    set({ executions })
  },

  setPlanQuestions: (executionId, nodeId, questions, analysis) => {
    get().updatePlanPhase(executionId, nodeId, 'questions', { questions })

    const execution = get().executions.get(executionId)
    if (!execution) return

    const pendingQuestion: PendingQuestion = {
      executionId,
      nodeId,
      nodeType: 'plan',
      questions: questions || [],
      analysis: analysis || '',
    }

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, pendingQuestion })

    set({ executions })
  },

  setPlanAnswers: (executionId, nodeId, answers) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const state = execution.planStates.get(nodeId)
    if (!state) return

    get().updatePlanPhase(executionId, nodeId, 'generating', { answers })
  },

  setPlanResult: (executionId, nodeId, plan) => {
    get().updatePlanPhase(executionId, nodeId, 'complete', { generatedPlan: plan })
  },

  setPlanError: (executionId, nodeId, error) => {
    get().updatePlanPhase(executionId, nodeId, 'error', { error })
  },

  getPlanState: (executionId, nodeId) => {
    const execution = get().executions.get(executionId)
    return execution?.planStates.get(nodeId)
  },

  getPlanStateForWorkspace: (workspacePath, nodeId) => {
    const activeExecutionId = get().getActiveExecution(workspacePath)
    if (!activeExecutionId) return undefined
    return get().getPlanState(activeExecutionId, nodeId)
  },

  clearPlanState: (executionId, nodeId) => {
    const execution = get().executions.get(executionId)
    if (!execution) return

    const newPlanStates = new Map(execution.planStates)
    newPlanStates.delete(nodeId)

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, planStates: newPlanStates })

    set({ executions })
  },

  clearPendingQuestion: (executionId) => {
    log('clearPendingQuestion', { executionId })
    const execution = get().executions.get(executionId)
    if (!execution) {
      log('clearPendingQuestion - execution not found', { executionId })
      return
    }

    const executions = new Map(get().executions)
    executions.set(executionId, { ...execution, pendingQuestion: null })

    set({ executions })
    log('clearPendingQuestion - cleared for execution:', executionId)
  },

  getPendingQuestion: (executionId) => {
    const execution = get().executions.get(executionId)
    return execution?.pendingQuestion || null
  },
}))
