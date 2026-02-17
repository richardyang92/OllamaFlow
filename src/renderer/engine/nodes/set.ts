import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, SetNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'

export function createSetExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as SetNodeData

      let value: unknown

      if (data.useExpression) {
        // First interpolate variables, then evaluate as expression
        const interpolated = interpolateVariables(data.variableValue, { ...context.variables, ...input })
        try {
          // Use Function constructor for safer evaluation than eval()
          value = new Function('return ' + interpolated)()
        } catch (error) {
          // If evaluation fails, use the literal value
          value = interpolated
        }
      } else {
        // Use literal value
        value = data.variableValue
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `Set ${data.variableName} = ${JSON.stringify(value)}`,
      })

      // Set the variable in context
      context.variables[data.variableName] = value

      return {
        [data.variableName]: value,
        value,
      }
    },
  }
}
