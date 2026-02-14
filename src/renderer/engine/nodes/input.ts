import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, InputNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'

export function createInputExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as InputNodeData

      // Interpolate the prompt and default value
      const resolvedPrompt = interpolateVariables(data.prompt, { ...context.variables, ...input })
      const resolvedDefault = interpolateVariables(data.defaultValue, { ...context.variables, ...input })

      // For now, use the default value since Electron doesn't have a native prompt dialog
      // In a full implementation, this would open a modal dialog to get user input
      let value: string | number | boolean = resolvedDefault

      // Convert value based on inputType
      switch (data.inputType) {
        case 'number':
          value = Number(resolvedDefault) || 0
          break
        case 'boolean':
          value = resolvedDefault.toLowerCase() === 'true' || resolvedDefault === '1'
          break
        default:
          // Keep as string
          break
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `Input requested: ${resolvedPrompt}`,
        data: { prompt: resolvedPrompt, defaultValue: resolvedDefault, value },
      })

      return {
        value,
        prompt: resolvedPrompt,
        inputType: data.inputType,
      }
    },
  }
}
