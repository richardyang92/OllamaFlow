import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, IfNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'

export function createIfExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as IfNodeData

      // Interpolate variables in expression
      const expression = interpolateVariables(data.expression, { ...context.variables, ...input })

      let result: boolean

      try {
        // Simple expression evaluation
        // Support basic comparisons: ==, !=, >, <, >=, <=, &&, ||
        // Also support 'true' and 'false' literals
        const evalExpression = expression
          .replace(/==/g, '===')
          .replace(/!=/g, '!==')
          .replace(/\btrue\b/g, 'true')
          .replace(/\bfalse\b/g, 'false')
          .replace(/\bnull\b/g, 'null')
          .replace(/\bundefined\b/g, 'undefined')

        // Safe evaluation using Function constructor
        const safeEval = new Function('vars', `
          with(vars) {
            try {
              return ${evalExpression};
            } catch(e) {
              return false;
            }
          }
        `)

        result = Boolean(safeEval({ ...context.variables, ...input }))
      } catch {
        // If evaluation fails, default to false
        result = false
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `Condition evaluated to: ${result}`,
        data: { expression, result },
      })

      return {
        result,
        true: result ? input : undefined,
        false: result ? undefined : input,
      }
    },
  }
}
