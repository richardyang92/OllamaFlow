/**
 * OpenAI API Client for Debug Mode
 * Supports both streaming and non-streaming chat completions
 * Supports Function Calling for ReAct Agent
 */

import { withRetry, RetryableError, type RetryConfig } from './react-agent/retry-handler'
import { DEFAULT_ENDPOINTS } from '@/config/model-config'

// OpenAI API Types
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
  // DeepSeek reasoner model requires this field
  reasoning_content?: string
}

export interface OpenAIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: string
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export interface OpenAIChatOptions {
  model: string
  messages: OpenAIMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
  tools?: OpenAITool[]
}

export interface OpenAIChatResponse {
  content: string
  tool_calls?: OpenAIToolCall[]
  finish_reason: string
  // DeepSeek reasoner model returns this field
  reasoning_content?: string
}

// Streaming tool call accumulator
interface StreamingToolCall {
  id: string
  name: string
  arguments: string
}

/**
 * OpenAI API Client
 */
export class OpenAIClient {
  private apiKey: string
  private baseUrl: string
  private skipAuth: boolean

  constructor(apiKey: string, baseUrl: string = DEFAULT_ENDPOINTS.openai) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    // Skip auth header for Ollama or when using placeholder
    // 通过端口识别 Ollama 端点（兼容 127.0.0.1 / localhost 两种写法）
    const ollamaPort = DEFAULT_ENDPOINTS.ollama.split(':').pop() // '11434'
    this.skipAuth = apiKey === 'ollama' || baseUrl.includes(`:${ollamaPort}`)
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (!this.skipAuth) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }
    return headers
  }

  /**
   * Non-streaming chat completion
   */
  async chat(
    options: OpenAIChatOptions,
    retryConfig?: Partial<RetryConfig>
  ): Promise<OpenAIChatResponse> {
    const executeRequest = async () => {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          stream: false,
          tools: options.tools,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        if ([408, 429, 500, 502, 503, 504].includes(response.status)) {
          throw new RetryableError(response.status, errorText)
        }
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const choice = data.choices[0]
      const message = choice.message || {}

      return {
        content: message.content || '',
        tool_calls: message.tool_calls,
        finish_reason: choice.finish_reason,
        reasoning_content: message.reasoning_content || message.reasoning || '',
      }
    }

    if (retryConfig) {
      const { result } = await withRetry(executeRequest, retryConfig)
      return result
    }
    
    return executeRequest()
  }

  /**
   * Streaming chat completion with tool calls support
   * Yields content chunks as they arrive, returns full response including tool calls
   * @param options Chat options
   * @param onContentChunk Callback for content chunks (not called for tool-only responses)
   * @param onToolCallName Callback when tool name is first received (for UI feedback)
   * @param onReasoningChunk Callback for reasoning content chunks (DeepSeek R1, etc.)
   * @param retryConfig Optional retry configuration
   */
  async chatStreamWithTools(
    options: OpenAIChatOptions,
    onContentChunk?: (chunk: string) => void,
    onToolCallName?: (toolName: string) => void,
    onReasoningChunk?: (chunk: string) => void,
    retryConfig?: Partial<RetryConfig>
  ): Promise<OpenAIChatResponse> {
    const executeRequest = async () => {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          stream: true,
          tools: options.tools,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        if ([408, 429, 500, 502, 503, 504].includes(response.status)) {
          throw new RetryableError(response.status, errorText)
        }
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to get response reader')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let reasoningContent = ''
      const toolCallsMap = new Map<string, StreamingToolCall>()
      const indexToId = new Map<number, string>()
      let finishReason = 'stop'

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data:')) continue

            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') {
              continue
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta
              const finish = parsed.choices?.[0]?.finish_reason

              if (finish) {
                finishReason = finish
              }

              if (delta?.content) {
                fullContent += delta.content
                onContentChunk?.(delta.content)
              }

              if (delta?.reasoning_content) {
                reasoningContent += delta.reasoning_content
                onReasoningChunk?.(delta.reasoning_content)
              } else if (delta?.reasoning) {
                reasoningContent += delta.reasoning
                onReasoningChunk?.(delta.reasoning)
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const index = tc.index !== undefined ? tc.index : 0
                  const indexBasedId = `call_idx_${index}`

                  let id: string

                  if (tc.id) {
                    id = tc.id
                    indexToId.set(index, id)

                    const existingByIndex = toolCallsMap.get(indexBasedId)
                    if (existingByIndex && !toolCallsMap.has(id)) {
                      toolCallsMap.set(id, existingByIndex)
                      toolCallsMap.delete(indexBasedId)
                    }
                  } else {
                    if (indexToId.has(index)) {
                      id = indexToId.get(index)!
                    } else {
                      id = indexBasedId
                    }
                  }

                  if (!toolCallsMap.has(id)) {
                    const toolName = tc.function?.name || ''
                    toolCallsMap.set(id, {
                      id,
                      name: toolName,
                      arguments: '',
                    })
                  }

                  const existing = toolCallsMap.get(id)!
                  if (tc.function?.name) {
                    if (!existing.name && tc.function.name) {
                      if (onToolCallName) {
                        onToolCallName(tc.function.name)
                      }
                    }
                    existing.name = tc.function.name
                  }
                  if (tc.function?.arguments) {
                    existing.arguments += tc.function.arguments
                  }
                }
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      const validToolCalls = toolCallsMap.size > 0
        ? Array.from(toolCallsMap.values())
            .filter(tc => tc.name && tc.name.trim() !== '')
            .map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: tc.arguments,
              },
            }))
        : []

      const toolCalls: OpenAIToolCall[] | undefined = validToolCalls.length > 0 ? validToolCalls : undefined

      if (finishReason === 'tool_calls' && !toolCalls) {
        console.warn('[OpenAIClient] WARNING: finish_reason is tool_calls but no tool calls were parsed!')
      }

      return {
        content: fullContent,
        tool_calls: toolCalls,
        finish_reason: finishReason,
        reasoning_content: reasoningContent || undefined,
      }
    }

    if (retryConfig) {
      const { result } = await withRetry(executeRequest, retryConfig)
      return result
    }
    
    return executeRequest()
  }

  /**
   * Streaming chat completion (simple version, yields content only)
   * Yields content chunks as they arrive
   * @deprecated Use chatStreamWithTools for full tool call support
   */
  async *chatStream(options: OpenAIChatOptions): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: true,
        tools: options.tools,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Convert Ollama-style tools to OpenAI format
   */
  static convertToolsFromOllama(
    tools: Array<{ name: string; description: string; parameters: { type: string; properties: Record<string, unknown>; required?: string[] } }>
  ): OpenAITool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
  }
}

/**
 * Parse tool call arguments safely
 */
export function parseToolCallArgs(argsString: string): Record<string, unknown> {
  // Handle empty or whitespace-only strings
  if (!argsString || !argsString.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(argsString)
    return parsed
  } catch {
    // Try to fix common JSON issues
    try {
      // Sometimes LLM returns incomplete JSON, try to complete it
      let fixed = argsString.trim()
      if (!fixed.startsWith('{')) fixed = '{' + fixed
      if (!fixed.endsWith('}')) fixed = fixed + '}'
      const parsed = JSON.parse(fixed)
      return parsed
    } catch {
      return {}
    }
  }
}
