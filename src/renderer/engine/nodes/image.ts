import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, ImageNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { useWorkflowStore } from '@/store/workflow-store'

export function createImageExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as ImageNodeData

      // 根据数据来源获取图片URL
      let imageUrl: string | undefined

      if (data.sourceType === 'variable' && data.variableName) {
        // 从上下文变量中获取值
        imageUrl = context.variables[data.variableName] as string | undefined
        if (imageUrl === undefined) {
          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'warn',
            message: `变量 "${data.variableName}" 未定义`,
          })
        }
      } else {
        // 使用输入值（默认行为）
        imageUrl = input.data as string
      }

      if (imageUrl) {
        // Update node data to display image URL in the UI
        const workflowStore = useWorkflowStore.getState()
        workflowStore.updateNodeData(node.id, { imageUrl })

        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `显示图片: ${imageUrl}`,
          data: imageUrl,
        })

        return {
          data: imageUrl,
        }
      } else {
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'warn',
          message: '未提供图片URL',
        })

        return {
          data: null,
        }
      }
    },
  }
}
