import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, OllamaChatNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'

interface OllamaChatResponse {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
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

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'debug',
        message: `Sending request to Ollama: ${data.model}`,
        data: { systemPrompt, userMessage },
      })

      try {
        const response = await fetch(`${context.ollamaHost}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: data.model,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: userMessage },
            ],
            stream: data.stream,
            options: {
              temperature: data.temperature,
              top_p: data.topP,
              num_predict: data.maxTokens,
            },
          }),
        })

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
        }

        if (data.stream && response.body) {
          // Handle streaming response
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let fullResponse = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter((line) => line.trim())

            for (const line of lines) {
              try {
                const parsed = JSON.parse(line) as OllamaChatResponse
                if (parsed.message?.content) {
                  fullResponse += parsed.message.content
                  context.onStream?.(node.id, parsed.message.content)
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
          }

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: 'Ollama response completed',
          })

          return {
            response: fullResponse,
            model: data.model,
          }
        } else {
          // Handle non-streaming response
          const result = await response.json() as { message: { content: string } }
          const content = result.message?.content || ''

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: 'Ollama response received',
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
          message: `Ollama request failed: ${errorMessage}`,
        })
        throw error
      }
    },
  }
}
