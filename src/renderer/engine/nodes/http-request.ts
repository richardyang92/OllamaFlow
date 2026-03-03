import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, HttpRequestNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'

export function createHttpRequestExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as HttpRequestNodeData

      // Interpolate URL
      const url = interpolateVariables(data.url, { ...context.variables, ...input })

      if (!url) {
        throw new Error('HTTP 请求节点未配置 URL')
      }

      // Build headers
      const headers: Record<string, string> = {}
      for (const [key, value] of Object.entries(data.headers || {})) {
        headers[key] = interpolateVariables(value, { ...context.variables, ...input })
      }

      // Set Content-Type based on bodyType
      if (data.bodyType === 'json' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      } else if (data.bodyType === 'form' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }

      // Build body
      let body: string | undefined
      if (data.bodyType !== 'none' && data.body) {
        body = interpolateVariables(data.body, { ...context.variables, ...input })
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'debug',
        message: `发送 ${data.method} 请求: ${url}`,
        data: { method: data.method, url, headers, bodyLength: body?.length },
      })

      try {
        const result = await window.electronAPI.http.fetch({
          url,
          method: data.method,
          headers,
          body,
          timeout: data.timeout,
        })

        if (!result.success) {
          throw new Error(result.error || 'HTTP 请求失败')
        }

        // Parse response
        let response: unknown
        if (data.responseType === 'json') {
          try {
            response = JSON.parse(result.body)
          } catch {
            // If JSON parsing fails, return as text
            response = result.body
          }
        } else {
          response = result.body
        }

        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `HTTP ${result.status} 响应`,
          data: {
            status: result.status,
            responseLength: typeof result.body === 'string' ? result.body.length : 'N/A',
          },
        })

        return {
          response,
          status: result.status,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'error',
          message: `HTTP 请求失败: ${errorMessage}`,
        })
        throw error
      }
    },
  }
}
