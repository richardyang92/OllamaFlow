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
      } else {
        content = input.content !== undefined ? String(input.content) : ''
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
        message: `Writing to file: ${filePath}`,
      })

      const result = await window.electronAPI.file.write(context.workspacePath, filePath, content)

      if (!result.success) {
        throw new Error(`Failed to write file: ${result.error}`)
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `Wrote ${content.length} bytes to ${filePath}`,
      })

      return {
        success: true,
        path: filePath,
        bytesWritten: content.length,
      }
    },
  }
}
