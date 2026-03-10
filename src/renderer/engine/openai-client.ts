/**
 * OpenAI API Client for Debug Mode
 * Supports both streaming and non-streaming chat completions
 * Supports Function Calling for ReAct Agent
 */

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

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    // Skip auth header for Ollama or when using placeholder
    this.skipAuth = apiKey === 'ollama' || baseUrl.includes('127.0.0.1:11434') || baseUrl.includes('localhost:11434')
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
  async chat(options: OpenAIChatOptions): Promise<OpenAIChatResponse> {
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
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
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

  /**
   * Streaming chat completion with tool calls support
   * Yields content chunks as they arrive, returns full response including tool calls
   * @param options Chat options
   * @param onContentChunk Callback for content chunks (not called for tool-only responses)
   * @param onToolCallName Callback when tool name is first received (for UI feedback)
   * @param onReasoningChunk Callback for reasoning content chunks (DeepSeek R1, etc.)
   */
  async chatStreamWithTools(
    options: OpenAIChatOptions,
    onContentChunk?: (chunk: string) => void,
    onToolCallName?: (toolName: string) => void,
    onReasoningChunk?: (chunk: string) => void
  ): Promise<OpenAIChatResponse> {
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
    let fullContent = ''
    let reasoningContent = ''
    const toolCallsMap = new Map<string, StreamingToolCall>()
    const indexToId = new Map<number, string>() // Map tool call index to actual ID
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

            // Handle content
            if (delta?.content) {
              fullContent += delta.content
              onContentChunk?.(delta.content)
            }

            // Handle reasoning content (DeepSeek) - support both field names
            if (delta?.reasoning_content) {
              reasoningContent += delta.reasoning_content
              onReasoningChunk?.(delta.reasoning_content)
            } else if (delta?.reasoning) {
              reasoningContent += delta.reasoning
              onReasoningChunk?.(delta.reasoning)
            }

            // Handle tool calls streaming
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                // OpenAI streaming uses 'index' to identify which tool call this chunk belongs to
                // DeepSeek and other providers may only send 'id' in the first chunk, then use 'index' for subsequent chunks
                const index = tc.index !== undefined ? tc.index : 0
                const indexBasedId = `call_idx_${index}`

                // Determine the ID to use
                let id: string

                if (tc.id) {
                  // This chunk has an explicit ID (usually the first chunk)
                  id = tc.id
                  // Record the index to ID mapping for future chunks
                  indexToId.set(index, id)

                  // Check if we already have an entry for this index with a different ID
                  // If so, we need to migrate the data
                  const existingByIndex = toolCallsMap.get(indexBasedId)
                  if (existingByIndex && !toolCallsMap.has(id)) {
                    // Migrate from index-based ID to actual ID
                    toolCallsMap.set(id, existingByIndex)
                    toolCallsMap.delete(indexBasedId)
                  }
                } else {
                  // No explicit ID - use index to find the correct entry
                  if (indexToId.has(index)) {
                    // Found previously recorded ID for this index
                    id = indexToId.get(index)!
                  } else {
                    // First time seeing this index without ID, use index-based ID
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
                // Update name if provided in this chunk
                if (tc.function?.name) {
                  // Check if this is a new tool name (was empty before)
                  if (!existing.name && tc.function.name) {
                    // Notify when tool name is first received
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

    // Assemble tool calls - filter out entries with empty names
    // But be careful: if finish_reason is 'tool_calls', we should have some tool calls
    const validToolCalls = toolCallsMap.size > 0
      ? Array.from(toolCallsMap.values())
          .filter(tc => tc.name && tc.name.trim() !== '') // Only include tool calls with valid names
          .map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          }))
      : []

    // Only return undefined if we have no valid tool calls
    // Otherwise return the array (even if empty, to distinguish from "no tool calls at all")
    const toolCalls: OpenAIToolCall[] | undefined = validToolCalls.length > 0 ? validToolCalls : undefined

    // Sanity check: if finish_reason is 'tool_calls' but we have no tool calls, log a warning
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
