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

      let outputData: unknown
      if (data.sourceType === 'variable' && data.variableName) {
        outputData = context.variables[data.variableName]
        if (outputData === undefined) {
          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'warn',
            message: `变量 "${data.variableName}" 未定义`,
          })
        }
      } else {
        outputData = input.data ?? input
      }

      const outputString = typeof outputData === 'object' ? JSON.stringify(outputData, null, 2) : String(outputData)

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `Output (${data.outputType}): ${outputString}`,
        data: outputData,
      })

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
