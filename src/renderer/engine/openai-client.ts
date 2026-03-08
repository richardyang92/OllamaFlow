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
    let finishReason = 'stop'
    let chunkCount = 0
    let anonymousToolCallIndex = 0 // Counter for tool calls without IDs

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
            console.log('[Stream] Received [DONE] signal')
            continue
          }

          try {
            chunkCount++
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta
            const finish = parsed.choices?.[0]?.finish_reason

            // Debug first few chunks
            if (chunkCount <= 5) {
              console.log(`[Stream] Chunk ${chunkCount}:`, JSON.stringify(delta))
            }

            // Debug: Log first few deltas to see what fields are available
            if (fullContent === '' && reasoningContent === '' && finishReason === 'stop') {
              console.log('[OpenAIClient] First delta received:', JSON.stringify(delta))
            }

            if (finish) {
              finishReason = finish
              console.log('[Stream] Finish reason:', finish)
            }

            // Handle content
            if (delta?.content) {
              fullContent += delta.content
              onContentChunk?.(delta.content)
            }

            // Handle reasoning content (DeepSeek) - support both field names
            if (delta?.reasoning_content) {
              console.log('[OpenAIClient] reasoning_content delta:', delta.reasoning_content.substring(0, 50) + '...')
              reasoningContent += delta.reasoning_content
              onReasoningChunk?.(delta.reasoning_content)
            } else if (delta?.reasoning) {
              console.log('[OpenAIClient] reasoning delta:', delta.reasoning.substring(0, 50) + '...')
              reasoningContent += delta.reasoning
              onReasoningChunk?.(delta.reasoning)
            }

            // Handle tool calls streaming
            if (delta?.tool_calls) {
              console.log('[Stream] tool_calls delta received:', JSON.stringify(delta.tool_calls))
              for (const tc of delta.tool_calls) {
                // Use id if provided, otherwise generate a stable ID
                // Some providers (like Ollama) may not send IDs in streaming mode
                let id = tc.id

                // If no ID provided, try to find existing tool call by name
                if (!id) {
                  const toolName = tc.function?.name
                  if (toolName) {
                    // Check if we already have a tool call with this name
                    const existingEntry = Array.from(toolCallsMap.entries()).find(([_, v]) => v.name === toolName)
                    if (existingEntry) {
                      id = existingEntry[0]
                      console.log('[Stream] Found existing tool call by name:', toolName, 'with id:', id)
                    } else {
                      // Generate a new stable ID using an incrementing counter
                      id = `call_${anonymousToolCallIndex++}`
                      console.log('[Stream] Generated new ID for tool call:', toolName, 'id:', id)
                    }
                  }
                }

                console.log('[Stream] Processing tool call chunk:', { id, tcId: tc.id, name: tc.function?.name, hasArgs: !!tc.function?.arguments })

                if (!id) {
                  // Skip if we still can't determine an ID
                  console.log('[Stream] Skipping tool call chunk - unable to determine ID')
                  continue
                }

                if (!toolCallsMap.has(id)) {
                  const toolName = tc.function?.name || ''
                  console.log('[Stream] Creating new tool call entry:', { id, toolName })
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
                    console.log('[Stream] Tool name received:', tc.function.name)
                    // Notify when tool name is first received
                    if (onToolCallName) {
                      console.log('[Stream] Calling onToolCallName callback')
                      onToolCallName(tc.function.name)
                    }
                  }
                  existing.name = tc.function.name
                }
                if (tc.function?.arguments) {
                  existing.arguments += tc.function.arguments
                  console.log('[Stream] Arguments accumulated for', existing.name || '(unnamed)', 'length:', existing.arguments.length)
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
      console.log('[Stream] Stream ended. Total chunks:', chunkCount)
      console.log('[Stream] Final state:', {
        fullContentLength: fullContent.length,
        reasoningContentLength: reasoningContent.length,
        toolCallsMapSize: toolCallsMap.size,
        finishReason
      })
    }

    // Debug: Log tool calls before filtering
    console.log('[OpenAIClient] toolCallsMap before assembly:', Array.from(toolCallsMap.entries()).map(([id, tc]) => ({ id, name: tc.name, argsLength: tc.arguments.length })))

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

    console.log('[OpenAIClient] Final tool_calls:', toolCalls ? toolCalls.map(tc => ({ id: tc.id, name: tc.function.name })) : 'none')
    console.log('[OpenAIClient] finish_reason:', finishReason)

    // Sanity check: if finish_reason is 'tool_calls' but we have no tool calls, log a warning
    if (finishReason === 'tool_calls' && !toolCalls) {
      console.warn('[OpenAIClient] WARNING: finish_reason is tool_calls but no tool calls were parsed!')
      console.warn('[OpenAIClient] toolCallsMap entries:', Array.from(toolCallsMap.entries()))
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
  try {
    return JSON.parse(argsString)
  } catch {
    return {}
  }
}
