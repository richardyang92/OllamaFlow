import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, QueueNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { useExecutionStore } from '@/store/execution-store'

export function createQueueExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as QueueNodeData
      const inputCount = data.inputCount || 2
      const store = useExecutionStore.getState()

      const currentInputs: unknown[] = []

      if (input.input !== undefined) {
        currentInputs.push(input.input)
      }

      for (let i = 1; i <= inputCount; i++) {
        const inputKey = `input${i}`
        if (input[inputKey] !== undefined) {
          currentInputs.push(input[inputKey])
        }
      }

      if (currentInputs.length > 0) {
        store.clearQueue(node.id)
        const output = currentInputs.length === 1 ? currentInputs[0] : currentInputs
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `清空队列并透传当前输入`,
        })
        return output
      }

      const dequeuedItem = store.dequeue(node.id)

      if (dequeuedItem !== undefined) {
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `出队一个元素，剩余 ${store.getQueue(node.id).length} 个`,
        })
        return dequeuedItem
      } else {
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `队列为空，跳过`,
        })
        return undefined
      }
    },
  }
}
