/**
 * Unified LLM types for ReAct agent
 * Uses OpenAI-compatible API format (works with Ollama, OpenAI, DeepSeek, etc.)
 */

/**
 * LLM Provider type
 * Note: All providers now use OpenAI-compatible API
 */
export type LLMProvider = 'ollama' | 'openai'

/**
 * Unified tool call representation
 */
export interface StandardToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/**
 * Unified message format
 */
export interface StandardMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: StandardToolCall[]
  tool_call_id?: string // Required for tool responses
  metadata?: Record<string, unknown> // Store provider-specific fields (e.g., reasoning_content)
}

/**
 * Unified LLM response format
 */
export interface StandardLLMResponse {
  content: string
  tool_calls?: StandardToolCall[]
  finish_reason: string
  raw_metadata?: Record<string, unknown> // Provider-specific metadata
}

/**
 * Unified tool definition format
 */
export interface StandardTool {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, unknown>
    required?: string[]
  }
}

/**
 * LLM chat configuration
 */
export interface LLMChatConfig {
  model: string
  temperature?: number
  max_tokens?: number
  top_p?: number
  stream?: boolean
  tools?: StandardTool[]
}

/**
 * LLM client configuration
 */
export interface LLMClientConfig {
  model: string
  apiEndpoint: string
  apiKey?: string
}
