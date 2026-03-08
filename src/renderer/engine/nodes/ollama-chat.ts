import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, OllamaChatNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'
import { OpenAIClient, OpenAIMessage } from '../openai-client'
import { resolveAIConfig } from '../config-resolver'

/**
 * Get API configuration from global config
 */
async function getAPIConfig(): Promise<{ apiKey: string; apiEndpoint: string }> {
  const config = await resolveAIConfig()
  return {
    apiKey: config.apiKey || '',
    apiEndpoint: config.apiEndpoint,
  }
}

export function createOllamaChatExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as OllamaChatNodeData

      // Interpolate variables in prompts
      const systemPrompt = interpolateVariables(data.systemPrompt, { ...context.variables, ...input })
      const userMessage = interpolateVariables(data.userMessage, { ...context.variables, ...input })

      // Get API configuration (respects global config priority)
      const { apiKey, apiEndpoint } = await getAPIConfig(context)

      // Create client with resolved endpoint
      const client = new OpenAIClient(apiKey, apiEndpoint)

      const messages: OpenAIMessage[] = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: userMessage },
      ]

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `调用 AI API: ${data.model}`,
      })

      try {
        if (data.stream) {
          // Handle streaming response
          let fullResponse = ''
          let chunkCount = 0

          for await (const chunk of client.chatStream({
            model: data.model,
            messages,
            temperature: data.temperature,
            max_tokens: data.maxTokens,
          })) {
            // Check if execution was cancelled
            if (context.signal?.aborted) {
              context.onLog?.({
                nodeId: node.id,
                nodeName: data.label,
                level: 'info',
                message: '响应已取消',
              })
              break
            }

            chunkCount++
            fullResponse += chunk
            context.onStream?.(node.id, chunk)
          }

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: 'AI 响应完成',
            data: { fullResponse, chunkCount },
          })

          return {
            response: fullResponse,
            model: data.model,
          }
        } else {
          // Handle non-streaming response
          const result = await client.chat({
            model: data.model,
            messages,
            temperature: data.temperature,
            max_tokens: data.maxTokens,
          })

          const content = result.content || ''

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: 'AI 响应已接收',
            data: { content, hasContent: !!content },
          })

          return {
            response: content,
            model: data.model,
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'error',
          message: `API 请求失败: ${errorMessage}`,
        })
        throw error
      }
    },
  }
}
