import { useEffect, useState } from 'react'
import { useExecutionStore } from '@/store/execution-store'
import type { ReActExecutionState } from '@/types/node'

export function useReActState(nodeId: string): ReActExecutionState | undefined {
  const [state, setState] = useState<ReActExecutionState | undefined>(() =>
    useExecutionStore.getState().getReActState(nodeId)
  )

  useEffect(() => {
    // Get initial state
    const initialState = useExecutionStore.getState().getReActState(nodeId)
    setState(initialState)

    // Subscribe to store changes
    const unsubscribe = useExecutionStore.subscribe(() => {
      const newState = useExecutionStore.getState().getReActState(nodeId)
      setState(newState)
    })

    return () => {
      unsubscribe()
    }
  }, [nodeId])

  return state
}
