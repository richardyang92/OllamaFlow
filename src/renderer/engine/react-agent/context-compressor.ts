/**
 * Context Compressor for ReAct Agent
 * Automatically compresses message history when approaching context length limits
 */

import type { OpenAIMessage } from '../openai-client'

/**
 * Generic message type that works with OpenAI-compatible API format
 */
export type GenericMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
  tool_call_id?: string
  reasoning_content?: string
}

/**
 * Convert OpenAIMessage to GenericMessage
 */
export function openaiToGeneric(messages: OpenAIMessage[]): GenericMessage[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    tool_calls: msg.tool_calls?.map(tc => ({
      id: tc.id,
      type: tc.type || 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments
      }
    })),
    tool_call_id: msg.tool_call_id,
    reasoning_content: msg.reasoning_content,
  }))
}

/**
 * Convert GenericMessage back to OpenAIMessage
 */
export function genericToOpenai(messages: GenericMessage[]): OpenAIMessage[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    tool_calls: msg.tool_calls,
    tool_call_id: msg.tool_call_id,
    reasoning_content: msg.reasoning_content,
  })) as OpenAIMessage[]
}

/**
 * Estimate token count for a message
 * This is a rough estimation: ~4 characters per token for Chinese/English mixed content
 */
function estimateTokens(text: string): number {
  // More accurate estimation considering:
  // - Chinese characters: ~1.5 tokens each
  // - English words: ~1.3 tokens per word (average 5 chars)
  // - Whitespace and punctuation: varies

  // Simple approximation: count Chinese chars separately
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const otherChars = text.length - chineseChars

  // Chinese: ~1.5 tokens/char, Other: ~0.25 tokens/char (4 chars per token)
  return Math.ceil(chineseChars * 1.5 + otherChars * 0.25)
}

/**
 * Estimate total tokens in message array
 */
export function estimateMessageTokens(messages: GenericMessage[] | OpenAIMessage[]): number {
  let total = 0

  for (const msg of messages) {
    // Role and formatting overhead (~4 tokens per message)
    total += 4

    // Content
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content)
    }

    // Tool calls
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += estimateTokens(tc.function.name)
        const args = typeof tc.function.arguments === 'string'
          ? tc.function.arguments
          : JSON.stringify(tc.function.arguments)
        total += estimateTokens(args)
      }
    }

    // Reasoning content (for DeepSeek)
    if ('reasoning_content' in msg && msg.reasoning_content) {
      total += estimateTokens(msg.reasoning_content)
    }

    // Tool call ID
    if ('tool_call_id' in msg && msg.tool_call_id) {
      total += 2
    }
  }

  return total
}

/**
 * Compression result
 */
export interface CompressionResult<T = GenericMessage> {
  messages: T[]
  compressed: boolean
  originalTokens: number
  newTokens: number
  compressionRatio: number
  summary?: string
}


/**
 * Extract and compress a group of messages (thought-action-observation cycle)
 * Returns a summary message
 */
function compressStepGroup(
  assistantMsg: GenericMessage,
  toolMsgs: GenericMessage[]
): { summary: string; success: boolean } {
  const thought = (assistantMsg.content as string) || ''
  const actions: string[] = []
  const observations: string[] = []
  let allSuccess = true

  // Extract actions from tool calls
  if (assistantMsg.tool_calls) {
    for (const tc of assistantMsg.tool_calls) {
      actions.push(`${tc.function.name}(${tc.function.arguments.slice(0, 100)}...)`)
    }
  }

  // Extract observations from tool responses
  for (const toolMsg of toolMsgs) {
    const content = (toolMsg.content as string) || ''
    const isError = content.includes('错误:') || content.includes('失败') || content.includes('Error')
    if (isError) allSuccess = false

    // Truncate long observations
    const truncatedObs = content.length > 200
      ? content.slice(0, 200) + '...'
      : content
    observations.push(truncatedObs)
  }

  // Create summary
  const summary = `[已压缩步骤]
思考: ${thought.slice(0, 150)}${thought.length > 150 ? '...' : ''}
行动: ${actions.join('; ')}
观察: ${observations.join('; ')}
结果: ${allSuccess ? '成功' : '失败'}`

  return { summary, success: allSuccess }
}

/**
 * Compress message history to fit within token limit
 *
 * Strategy:
 * 1. Keep system message and recent user message
 * 2. Keep last N iterations (configurable)
 * 3. Compress middle iterations into summaries
 * 4. Truncate very long observations
 */
export function compressContext(
  messages: GenericMessage[],
  maxTokens: number,
  options: {
    keepRecentIterations?: number
    maxObservationLength?: number
    enableSummarization?: boolean
  } = {}
): CompressionResult<GenericMessage> {
  const {
    keepRecentIterations = 3,
    maxObservationLength = 1000,
    enableSummarization = true
  } = options

  const originalTokens = estimateMessageTokens(messages)

  // If under limit, no compression needed
  if (originalTokens <= maxTokens) {
    return {
      messages,
      compressed: false,
      originalTokens,
      newTokens: originalTokens,
      compressionRatio: 1,
    }
  }

  // Separate messages by type
  const systemMessages = messages.filter(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')

  // Identify iteration boundaries (assistant + tool responses)
  const iterations: Array<{ assistant: GenericMessage; tools: GenericMessage[] }> = []
  let currentIteration: { assistant: GenericMessage | null; tools: GenericMessage[] } = { assistant: null, tools: [] }
  let userMessages: GenericMessage[] = []

  for (const msg of conversationMessages) {
    if (msg.role === 'user') {
      // If we have a completed iteration, save it
      if (currentIteration.assistant) {
        iterations.push({
          assistant: currentIteration.assistant,
          tools: [...currentIteration.tools]
        })
        currentIteration = { assistant: null, tools: [] }
      }
      userMessages.push(msg)
    } else if (msg.role === 'assistant') {
      // If we have a previous assistant message, save that iteration
      if (currentIteration.assistant) {
        iterations.push({
          assistant: currentIteration.assistant,
          tools: [...currentIteration.tools]
        })
        currentIteration = { assistant: null, tools: [] }
      }
      currentIteration.assistant = msg
    } else if (msg.role === 'tool') {
      if (currentIteration.assistant) {
        currentIteration.tools.push(msg)
      }
    }
  }

  // Don't forget the last iteration
  if (currentIteration.assistant) {
    iterations.push({
      assistant: currentIteration.assistant,
      tools: [...currentIteration.tools]
    })
  }

  // If no iterations, just return truncated messages
  if (iterations.length === 0) {
    // Truncate long content in messages
    const truncatedMessages = messages.map(msg => {
      if (typeof msg.content === 'string' && msg.content.length > maxObservationLength) {
        return {
          ...msg,
          content: msg.content.slice(0, maxObservationLength) + '...[已截断]'
        }
      }
      return msg
    })

    const newTokens = estimateMessageTokens(truncatedMessages)
    return {
      messages: truncatedMessages,
      compressed: true,
      originalTokens,
      newTokens,
      compressionRatio: newTokens / originalTokens,
    }
  }

  // Determine which iterations to keep and which to compress
  const recentIterations = iterations.slice(-keepRecentIterations)
  const oldIterations = iterations.slice(0, -keepRecentIterations)

  // Build new message array
  const newMessages: GenericMessage[] = [...systemMessages]

  // Add first user message if exists
  if (userMessages.length > 0) {
    newMessages.push(userMessages[0])
  }

  // Compress old iterations into a summary
  if (oldIterations.length > 0 && enableSummarization) {
    const compressedSteps: string[] = []

    for (const iter of oldIterations) {
      const { summary } = compressStepGroup(iter.assistant, iter.tools)
      compressedSteps.push(summary)
    }

    const compressionSummary: GenericMessage = {
      role: 'user',
      content: `[上下文压缩摘要]
以下是之前 ${oldIterations.length} 个步骤的压缩摘要：

${compressedSteps.join('\n\n')}

请基于以上历史继续执行任务。`
    }
    newMessages.push(compressionSummary)
  }

  // Add recent iterations (with truncated observations)
  for (const iter of recentIterations) {
    newMessages.push(iter.assistant)

    for (const toolMsg of iter.tools) {
      if (typeof toolMsg.content === 'string' && toolMsg.content.length > maxObservationLength) {
        newMessages.push({
          ...toolMsg,
          content: toolMsg.content.slice(0, maxObservationLength) + '...[已截断]'
        })
      } else {
        newMessages.push(toolMsg)
      }
    }
  }

  // Add remaining user messages (except the first one which was already added)
  for (let i = 1; i < userMessages.length; i++) {
    newMessages.push(userMessages[i])
  }

  const newTokens = estimateMessageTokens(newMessages)

  return {
    messages: newMessages,
    compressed: true,
    originalTokens,
    newTokens,
    compressionRatio: newTokens / originalTokens,
    summary: `压缩了 ${oldIterations.length} 个旧步骤，保留 ${recentIterations.length} 个最近步骤`,
  }
}

/**
 * Compress OpenAI messages (main export)
 */
export function compressOpenAIContext(
  messages: OpenAIMessage[],
  maxTokens: number,
  options: {
    keepRecentIterations?: number
    maxObservationLength?: number
    enableSummarization?: boolean
  } = {}
): CompressionResult<OpenAIMessage> {
  const genericMessages = openaiToGeneric(messages)
  const result = compressContext(genericMessages, maxTokens, options)
  return {
    ...result,
    messages: genericToOpenai(result.messages),
  }
}

/**
 * Compress Ollama messages (alias for compressOpenAIContext since Ollama uses OpenAI-compatible format)
 */
export const compressOllamaContext = compressOpenAIContext

/**
 * Truncate long tool observations in place
 */
export function truncateObservations(
  messages: GenericMessage[],
  maxLength: number = 2000
): GenericMessage[] {
  return messages.map(msg => {
    if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > maxLength) {
      return {
        ...msg,
        content: msg.content.slice(0, maxLength) + '\n...[内容已截断以节省上下文空间]'
      }
    }
    return msg
  })
}

/**
 * Smart context management configuration
 */
export interface ContextConfig {
  /** Maximum tokens before compression triggers */
  maxContextTokens: number
  /** Reserve tokens for response generation */
  reserveTokens: number
  /** Number of recent iterations to keep uncompressed */
  keepRecentIterations: number
  /** Maximum length for single observation */
  maxObservationLength: number
  /** Enable compression into summaries */
  enableSummarization: boolean
}

/**
 * Default context configuration for different models
 */
export const DEFAULT_CONTEXT_CONFIGS: Record<string, ContextConfig> = {
  // OpenAI models
  'gpt-4': {
    maxContextTokens: 8000, // 8k context, reserve for response
    reserveTokens: 1000,
    keepRecentIterations: 3,
    maxObservationLength: 1500,
    enableSummarization: true,
  },
  'gpt-4-turbo': {
    maxContextTokens: 120000, // 128k context
    reserveTokens: 4000,
    keepRecentIterations: 5,
    maxObservationLength: 2000,
    enableSummarization: true,
  },
  'gpt-4o': {
    maxContextTokens: 120000, // 128k context
    reserveTokens: 4000,
    keepRecentIterations: 5,
    maxObservationLength: 2000,
    enableSummarization: true,
  },
  'gpt-3.5-turbo': {
    maxContextTokens: 4000, // 4k context (old model)
    reserveTokens: 500,
    keepRecentIterations: 2,
    maxObservationLength: 1000,
    enableSummarization: true,
  },
  // DeepSeek models
  'deepseek-chat': {
    maxContextTokens: 60000, // 64k context
    reserveTokens: 4000,
    keepRecentIterations: 5,
    maxObservationLength: 2000,
    enableSummarization: true,
  },
  'deepseek-reasoner': {
    maxContextTokens: 60000, // 64k context
    reserveTokens: 4000,
    keepRecentIterations: 4,
    maxObservationLength: 1500,
    enableSummarization: true,
  },
  // Default for unknown models
  'default': {
    maxContextTokens: 100000, // Safe default
    reserveTokens: 4000,
    keepRecentIterations: 4,
    maxObservationLength: 1500,
    enableSummarization: true,
  }
}

/**
 * Get context configuration for a model
 */
export function getContextConfig(model: string): ContextConfig {
  // Normalize model name
  const normalizedModel = model.toLowerCase()

  // Check for exact match first
  if (DEFAULT_CONTEXT_CONFIGS[normalizedModel]) {
    return DEFAULT_CONTEXT_CONFIGS[normalizedModel]
  }

  // Check for partial matches
  for (const [key, config] of Object.entries(DEFAULT_CONTEXT_CONFIGS)) {
    if (normalizedModel.includes(key) || key.includes(normalizedModel.split('-')[0])) {
      return config
    }
  }

  return DEFAULT_CONTEXT_CONFIGS.default
}
