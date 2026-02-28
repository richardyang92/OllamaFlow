import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, SplitterNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'

export function createSplitterExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as SplitterNodeData
      const outputCount = data.outputCount || 2

      const inputValue = input.input

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `将输入分发到 ${outputCount} 个输出端口`,
      })

      const output: Record<string, unknown> = {}
      for (let i = 1; i <= outputCount; i++) {
        output[`output${i}`] = inputValue
      }

      return output
    },
  }
}
