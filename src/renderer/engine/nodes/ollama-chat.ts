import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, OllamaChatNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'
import { Ollama } from 'ollama/browser'

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

      try {
        // Create Ollama instance with custom host if provided
        const host = context.ollamaHost || 'http://localhost:11434'
        
        const ollamaInstance = new Ollama({ host })

        const messages = [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userMessage },
        ]

        const options = {
          temperature: data.temperature,
          top_p: data.topP,
          num_predict: data.maxTokens,
        }

        if (data.stream) {
          // Handle streaming response
          let fullResponse = ''
          const stream = await ollamaInstance.chat({
            model: data.model,
            messages,
            options,
            stream: true,
          })

          let chunkCount = 0
          for await (const chunk of stream) {
            chunkCount++
            
            if (chunk.message?.content) {
              const content = chunk.message.content
              fullResponse += content
              context.onStream?.(node.id, content)
            }
          }

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: 'Ollama response completed',
            data: { fullResponse, chunkCount },
          })

          return {
            response: fullResponse,
            model: data.model,
          }
        } else {
          // Handle non-streaming response
          const result = await ollamaInstance.chat({
            model: data.model,
            messages,
            options,
            stream: false,
          })
          
          const content = result.message?.content || ''

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: 'Ollama response received',
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
          message: `Ollama 请求失败: ${errorMessage}`,
        })
        throw error
      }
    },
  }
}
