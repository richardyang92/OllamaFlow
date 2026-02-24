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

/**
 * OpenAI API Client
 */
export class OpenAIClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  /**
   * Non-streaming chat completion
   */
  async chat(options: OpenAIChatOptions): Promise<OpenAIChatResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
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

    return {
      content: choice.message?.content || '',
      tool_calls: choice.message?.tool_calls,
      finish_reason: choice.finish_reason,
      reasoning_content: choice.message?.reasoning_content,
    }
  }

  /**
   * Streaming chat completion
   * Yields content chunks as they arrive
   */
  async *chatStream(options: OpenAIChatOptions): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
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
