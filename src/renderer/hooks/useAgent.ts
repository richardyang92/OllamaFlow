/**
 * useAgent Hook
 * 
 * React Hook for executing Agents in Web Workers
 * Provides a clean interface for Agent execution with callbacks
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentConfig, AgentCallbacks, AgentStep, ToolCallInfo, TodoItem } from '@/engine/workers/types'
import type { GeneratedFileInfo } from '@/store/agent-store'
import { getWorkerPool } from '@/engine/workers/worker-pool'

export interface UseAgentOptions extends Partial<AgentCallbacks> {
  sandboxPath: string
  priority?: 'high' | 'normal' | 'low'
}

export interface UseAgentReturn {
  execute: (config: AgentConfig, userInput: string) => Promise<void>
  cancel: () => void
  status: 'idle' | 'running' | 'completed' | 'error'
  currentStep: AgentStep | null
  thought: string
  toolCalls: ToolCallInfo[]
  todos: TodoItem[]
  error: string | null
  poolStatus: {
    totalWorkers: number
    idleWorkers: number
    busyWorkers: number
    queuedAgents: number
    activeSessions: number
  }
}

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const { sandboxPath, priority = 'normal', ...callbacks } = options
  
  // 状态
  const [status, setStatus] = useState<UseAgentReturn['status']>('idle')
  const [currentStep, setCurrentStep] = useState<AgentStep | null>(null)
  const [thought, setThought] = useState('')
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [poolStatus, setPoolStatus] = useState<UseAgentReturn['poolStatus']>({
    totalWorkers: 0,
    idleWorkers: 0,
    busyWorkers: 0,
    queuedAgents: 0,
    activeSessions: 0,
  })
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null)
  const poolRef = useRef(getWorkerPool())
  const currentAgentIdRef = useRef<string | null>(null)
  
  // 更新池状态
  useEffect(() => {
    const updatePoolStatus = () => {
      setPoolStatus(poolRef.current.getPoolStatus())
    }
    
    updatePoolStatus()
    const interval = setInterval(updatePoolStatus, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  // 执行 Agent
  const execute = useCallback(async (config: AgentConfig, userInput: string) => {
    // 重置状态
    setStatus('running')
    setCurrentStep(null)
    setThought('')
    setToolCalls([])
    setError(null)
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()
    
    // 创建 callbacks
    const agentCallbacks: AgentCallbacks = {
      onStepStart: (step) => {
        setCurrentStep(step)
        callbacks.onStepStart?.(step)
      },
      
      onStepUpdate: (stepId, update) => {
        setCurrentStep((prev) => {
          if (prev && prev.id === stepId) {
            return { ...prev, ...update }
          }
          return prev
        })
        callbacks.onStepUpdate?.(stepId, update)
      },
      
      onThoughtChunk: (stepId, chunk) => {
        setThought((prev) => prev + chunk)
        callbacks.onThoughtChunk?.(stepId, chunk)
      },
      
      onToolCallsStart: (calls) => {
        setToolCalls(calls)
        callbacks.onToolCallsStart?.(calls)
      },
      
      onToolCallUpdate: (toolCallId, update) => {
        setToolCalls((prev) =>
          prev.map((tc) =>
            tc.id === toolCallId ? { ...tc, ...update } : tc
          )
        )
        callbacks.onToolCallUpdate?.(toolCallId, update)
      },
      
      onTodosUpdate: (items) => {
        setTodos(items)
        callbacks.onTodosUpdate?.(items)
      },
      
      onComplete: (response, generatedFiles) => {
        setStatus('completed')
        callbacks.onComplete?.(response, generatedFiles)
      },
      
      onError: (err) => {
        setStatus('error')
        setError(err)
        callbacks.onError?.(err)
      },
      
      onIterationLimit: (current, max) => {
        callbacks.onIterationLimit?.(current, max)
      },
      
      onWaitingForInput: (prompt, context) => {
        callbacks.onWaitingForInput?.(prompt, context)
      },
    }
    
    try {
      const fullConfig: AgentConfig = {
        ...config,
        sandboxPath,
      }
      
      const result = await poolRef.current.executeAgent(
        fullConfig,
        userInput,
        agentCallbacks,
        {
          priority,
          signal: abortControllerRef.current.signal,
        }
      )
      
      currentAgentIdRef.current = null
      
    } catch (err) {
      if ((err as Error).message === 'Cancelled') {
        setStatus('idle')
      } else {
        setStatus('error')
        setError((err as Error).message)
      }
    }
  }, [sandboxPath, priority, callbacks])
  
  // 取消执行
  const cancel = useCallback(() => {
    if (currentAgentIdRef.current) {
      poolRef.current.cancelAgent(currentAgentIdRef.current)
      currentAgentIdRef.current = null
    }
    abortControllerRef.current?.abort()
    setStatus('idle')
  }, [])
  
  // 清理
  useEffect(() => {
    return () => {
      cancel()
    }
  }, [cancel])
  
  return {
    execute,
    cancel,
    status,
    currentStep,
    thought,
    toolCalls,
    todos,
    error,
    poolStatus,
  }
}
