/**
 * Abstract LLM client interface
 * All LLM providers must implement this interface
 */

import type {
  LLMProvider,
  LLMClientConfig,
  StandardMessage,
  StandardLLMResponse,
  StandardTool,
} from './types'

/**
 * Abstract LLM client interface
 * Defines the contract that all LLM providers must implement
 */
export interface ILLMClient {
  /**
   * Get the provider type identifier
   */
  readonly provider: LLMProvider

  /**
   * Get the current model name
   */
  readonly model: string

  /**
   * Send a chat request
   * @param messages - Standard format message array
   * @param config - Chat configuration
   * @returns Standard format response
   */
  chat(
    messages: StandardMessage[],
    config: LLMChatConfig
  ): Promise<StandardLLMResponse>

  /**
   * Create a tool response message
   * @param toolCallId - Tool call ID (from StandardToolCall.id)
   * @param content - Response content
   * @returns Standard format tool response message
   */
  createToolResponse(toolCallId: string, content: string): StandardMessage

  /**
   * Pre-processing before retry (for handling specific errors)
   * @param messages - Current message history
   * @param error - The error that occurred
   * @returns Whether to retry, and optionally modified messages
   */
  handleRetry?(
    messages: StandardMessage[],
    error: Error
  ): { shouldRetry: boolean; messages?: StandardMessage[] }

  /**
   * Clean up resources (e.g., close connections)
   */
  dispose?(): void | Promise<void>
}

/**
 * LLM client factory interface
 */
export interface ILLMClientFactory {
  /**
   * Create an LLM client instance
   * @param config - Client configuration
   */
  create(config: LLMClientConfig): ILLMClient
}

/**
 * Re-export chat config type
 */
export type { LLMChatConfig } from './types'
