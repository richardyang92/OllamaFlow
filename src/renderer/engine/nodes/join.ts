import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, JoinNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'

export function createJoinExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as JoinNodeData
      const inputCount = data.inputCount || 2

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `收集 ${inputCount} 个分支的输出`,
      })

      const output: Record<string, unknown> = {}
      for (let i = 1; i <= inputCount; i++) {
        const inputKey = `input${i}`
        if (input[inputKey] !== undefined) {
          output[inputKey] = input[inputKey]
        } else {
          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'warn',
            message: `输入端口 ${inputKey} 没有接收到数据`,
          })
          output[inputKey] = null
        }
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `汇聚完成，输出对象包含 ${Object.keys(output).length} 个字段`,
      })

      return output
    },
  }
}
