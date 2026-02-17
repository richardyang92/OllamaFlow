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

      // Check if user provided a value for this input node
      const userValue = context.userInputValues.get(node.id)

      // Use user-provided value, or fall back to default value
      let value: string | number | boolean = userValue || resolvedDefault

      // Convert value based on inputType
      switch (data.inputType) {
        case 'number':
          value = Number(value) || 0
          break
        case 'boolean':
          value = String(value).toLowerCase() === 'true' || value === '1'
          break
        default:
          // Keep as string
          value = String(value)
          break
      }

      const source = userValue ? 'user input' : 'default value'

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `Input: ${resolvedPrompt} = ${value} (${source})`,
        data: { prompt: resolvedPrompt, defaultValue: resolvedDefault, value, source },
      })

      return {
        value,
        prompt: resolvedPrompt,
        inputType: data.inputType,
      }
    },
  }
}
