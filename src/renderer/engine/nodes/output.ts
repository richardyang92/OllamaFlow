import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, OutputNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { useWorkflowStore } from '@/store/workflow-store'

export function createOutputExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as OutputNodeData
      const outputData = input.data ?? input
      
      // Convert outputData to string for display
      const outputString = typeof outputData === 'object' ? JSON.stringify(outputData) : String(outputData)

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `Output (${data.outputType}): ${outputString}`,
        data: outputData,
      })

      // Update node data to display output in the UI
      const workflowStore = useWorkflowStore.getState()
      workflowStore.updateNodeData(node.id, { output: outputString })

      switch (data.outputType) {
        case 'display':
          // Output is logged and displayed
          break
        case 'copy':
          // Copy to clipboard (in renderer process)
          try {
            await navigator.clipboard.writeText(outputString)
            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'info',
              message: '已复制到剪贴板',
            })
          } catch {
            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'warn',
              message: '复制到剪贴板失败',
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
