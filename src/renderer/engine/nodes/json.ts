import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, JsonNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'

// Simple JSONPath-like extraction using dot notation
function extractValue(obj: unknown, path: string): unknown {
  if (!path || path === '$' || path === '$.') {
    return obj
  }

  // Remove leading $. if present
  let cleanPath = path.startsWith('$.') ? path.slice(2) : path

  const parts = cleanPath.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }

    // Handle array index notation: items[0] -> items, 0
    const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/)
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch
      const index = parseInt(indexStr, 10)

      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key]
      }

      if (Array.isArray(current)) {
        current = current[index]
      } else {
        return undefined
      }
    } else if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return current
}

export function createJsonExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as JsonNodeData
      const mode = data.mode || 'parse'

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'debug',
        message: `JSON 处理模式: ${mode}`,
        data: { mode, inputKeys: Object.keys(input) },
      })

      try {
        let result: unknown

        switch (mode) {
          case 'parse': {
            // Parse JSON string to object
            let inputValue: unknown
            if (input.input !== undefined) {
              inputValue = input.input
            } else if (input.value !== undefined) {
              inputValue = input.value
            } else {
              // Use first available input value
              const firstKey = Object.keys(input)[0]
              inputValue = firstKey ? input[firstKey] : undefined
            }

            if (typeof inputValue === 'string') {
              result = JSON.parse(inputValue)
            } else if (typeof inputValue === 'object') {
              // Already an object, return as-is
              result = inputValue
            } else {
              throw new Error('输入必须是 JSON 字符串或对象')
            }
            break
          }

          case 'stringify': {
            // Convert object to JSON string
            let inputValue: unknown
            if (input.input !== undefined) {
              inputValue = input.input
            } else if (input.value !== undefined) {
              inputValue = input.value
            } else {
              // Use first available input value
              const firstKey = Object.keys(input)[0]
              inputValue = firstKey ? input[firstKey] : undefined
            }

            if (typeof inputValue === 'object') {
              result = JSON.stringify(inputValue, null, 2)
            } else if (typeof inputValue === 'string') {
              // Already a string, return as-is
              result = inputValue
            } else {
              result = String(inputValue)
            }
            break
          }

          case 'extract': {
            // Extract value using JSONPath-like syntax
            let inputValue: unknown
            if (input.input !== undefined) {
              inputValue = input.input
            } else if (input.value !== undefined) {
              inputValue = input.value
            } else {
              // Use first available input value
              const firstKey = Object.keys(input)[0]
              inputValue = firstKey ? input[firstKey] : undefined
            }

            if (!data.jsonPath) {
              throw new Error('提取模式需要设置 JSONPath 表达式')
            }

            result = extractValue(inputValue, data.jsonPath)

            if (result === undefined) {
              context.onLog?.({
                nodeId: node.id,
                nodeName: data.label,
                level: 'warn',
                message: `路径 "${data.jsonPath}" 未找到值`,
              })
            }
            break
          }

          case 'merge': {
            // Merge all input objects
            const merged: Record<string, unknown> = {}

            for (const value of Object.values(input)) {
              if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                Object.assign(merged, value)
              }
            }

            result = merged
            break
          }

          default:
            throw new Error(`未知的 JSON 处理模式: ${mode}`)
        }

        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `JSON 处理完成`,
          data: { mode, resultType: typeof result },
        })

        return { output: result }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'error',
          message: `JSON 处理失败: ${errorMessage}`,
        })
        throw error
      }
    },
  }
}
