import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, ReadFileNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'

export function createReadFileExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as ReadFileNodeData

      // Interpolate file path
      const filePath = input.path
        ? String(input.path)
        : interpolateVariables(data.filePath, { ...context.variables, ...input })

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'debug',
        message: `Reading file: ${filePath}`,
      })

      const result = await window.electronAPI.file.read(context.workspacePath, filePath)

      if (!result.success) {
        if (data.errorIfNotFound) {
          throw new Error(`读取文件失败: ${result.error}`)
        } else {
          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'warn',
            message: `文件未找到: ${filePath}`,
          })
          return {
            content: '',
            exists: false,
            path: filePath,
          }
        }
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `Read ${result.content?.length || 0} bytes from ${filePath}`,
      })

      return {
        content: result.content,
        exists: true,
        path: filePath,
      }
    },
  }
}
