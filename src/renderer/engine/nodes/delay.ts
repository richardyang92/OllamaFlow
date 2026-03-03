import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, DelayNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'

export function createDelayExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as DelayNodeData
      const delayMs = data.delayMs || 0

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `开始延迟 ${delayMs}ms`,
      })

      // Wait for the specified duration
      await new Promise((resolve) => setTimeout(resolve, delayMs))

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `延迟完成`,
      })

      // Return result based on passthrough setting
      if (data.passthrough) {
        return {
          ...input,
          delayedMs: delayMs,
        }
      }

      return {
        delayedMs: delayMs,
      }
    },
  }
}
