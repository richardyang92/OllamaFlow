import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, ManualTriggerNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'

export function createManualTriggerExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as ManualTriggerNodeData

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: 'Manual trigger executed',
      })

      // Trigger node just passes through and signals start
      return {
        trigger: true,
        timestamp: new Date().toISOString(),
      }
    },
  }
}
