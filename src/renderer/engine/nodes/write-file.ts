import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, WriteFileNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'

export function createWriteFileExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as WriteFileNodeData

      // Interpolate file path
      const filePath = interpolateVariables(data.filePath, { ...context.variables, ...input })

      // Determine content
      let content: string
      if (data.contentSource === 'direct') {
        content = interpolateVariables(data.directContent, { ...context.variables, ...input })
        if (!content) {
          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'warn',
            message: `内容来源设置为"直接输入内容"，但内容为空。请在属性面板中输入内容，或切换到"来自上游节点"模式`,
          })
        }
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'debug',
          message: `使用直接输入内容，长度: ${content.length}`,
        })
      } else {
        if (input.content === undefined) {
          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'warn',
            message: `内容来源设置为"来自上游节点"，但没有收到输入内容。请检查：1. 是否有节点连接到输入端口 2. 上游节点是否正确输出内容`,
          })
        } else if (input.content === '') {
          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'warn',
            message: `收到输入内容为空字符串。请检查上游节点是否正确输出内容`,
          })
        }
        content = input.content !== undefined ? String(input.content) : ''
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'debug',
          message: `使用上游节点输入内容，input.content类型: ${typeof input.content}, 值: ${JSON.stringify(input.content)?.slice(0, 100)}..., 长度: ${content.length}`,
        })
      }

      // Handle append mode
      if (data.writeMode === 'append') {
        const existingResult = await window.electronAPI.file.read(context.workspacePath, filePath)
        if (existingResult.success && existingResult.content) {
          content = existingResult.content + content
        }
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'debug',
        message: `正在写入文件: ${filePath}`,
      })

      const result = await window.electronAPI.file.write(context.workspacePath, filePath, content)

      if (!result.success) {
        throw new Error(`写入文件失败: ${result.error}`)
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `已写入 ${content.length} 字节到 ${filePath}`,
      })

      return {
        success: true,
        path: filePath,
        bytesWritten: content.length,
      }
    },
  }
}
