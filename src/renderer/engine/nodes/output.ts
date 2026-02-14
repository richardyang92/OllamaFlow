import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, OutputNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'

export function createOutputExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as OutputNodeData
      const outputData = input.data ?? input

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `Output (${data.outputType}): ${JSON.stringify(outputData)}`,
        data: outputData,
      })

      switch (data.outputType) {
        case 'display':
          // Output is logged and displayed
          break
        case 'copy':
          // Copy to clipboard (in renderer process)
          try {
            await navigator.clipboard.writeText(String(outputData))
            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'info',
              message: 'Copied to clipboard',
            })
          } catch {
            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'warn',
              message: 'Failed to copy to clipboard',
            })
          }
          break
        case 'download':
          // Trigger download (handled by renderer)
          break
      }

      return {
        data: outputData,
        outputType: data.outputType,
      }
    },
  }
}
