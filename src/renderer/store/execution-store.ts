import { create } from 'zustand'
import type {
  ExecutionStatus,
  ExecutionContext,
  NodeExecutionResult,
  ExecutionLog,
} from '@/types/execution'

interface ExecutionState {
  status: ExecutionStatus
  context: ExecutionContext | null
  logs: ExecutionLog[]
  streamingOutput: Map<string, string>

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
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  status: 'idle',
  context: null,
  logs: [],
  streamingOutput: new Map(),

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
}))
