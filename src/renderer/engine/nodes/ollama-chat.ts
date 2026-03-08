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
          // Handle streaming response with reasoning content support
          let chunkCount = 0

          const result = await client.chatStreamWithTools(
            {
              model: data.model,
              messages,
              temperature: data.temperature,
              max_tokens: data.maxTokens,
              stream: true,
            },
            // onContentChunk - normal response content
            (chunk) => {
              chunkCount++
              context.onStream?.(node.id, chunk)
            },
            // onToolCallName - not used for basic chat, but required by API
            undefined,
            // onReasoningChunk - reasoning content for DeepSeek R1, etc.
            (chunk) => {
              console.log('[OllamaChatExecutor] Reasoning chunk received:', chunk.substring(0, 50) + '...')
              context.onReasoningStream?.(node.id, chunk)
            }
          )

          const content = result.content || ''
          const reasoningContent = result.reasoning_content || ''

          // Log reasoning content if present
          if (reasoningContent) {
            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'debug',
              message: '推理内容已接收',
              data: { reasoningLength: reasoningContent.length },
            })
          }

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: 'AI 响应完成',
            data: { contentLength: content.length, chunkCount },
          })

          return {
            response: content,
            model: data.model,
            reasoning_content: reasoningContent,
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
          const reasoningContent = result.reasoning_content || ''

          console.log('[OllamaChatExecutor] Non-streaming result:', {
            contentLength: content.length,
            hasReasoning: !!reasoningContent,
            reasoningLength: reasoningContent?.length || 0,
            reasoningPreview: reasoningContent?.substring(0, 100) || 'none'
          })

          // For non-streaming, output the full reasoning content at once
          if (reasoningContent) {
            console.log('[OllamaChatExecutor] Calling onReasoningStream with:', reasoningContent.substring(0, 50) + '...')
            context.onReasoningStream?.(node.id, reasoningContent)
          }

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: 'AI 响应已接收',
            data: { contentLength: content.length, hasReasoning: !!reasoningContent },
          })

          return {
            response: content,
            model: data.model,
            reasoning_content: reasoningContent,
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
