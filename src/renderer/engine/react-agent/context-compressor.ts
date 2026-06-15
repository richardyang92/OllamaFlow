/**
 * Context Compressor for ReAct Agent
 * Automatically compresses message history when approaching context length limits
 * Supports both rule-based and LLM-driven compression
 */

import type { OpenAIMessage } from '../openai-client'
import { LLMCompressor, type LLMCompressionOptions } from './llm-compressor'
// ContextConfig / MODEL_CONTEXT_LIMITS / getContextConfig 统一从 @/config/model-config 引入
// （一处配置，处处生效），此处仅作重导出，保持历史 import 路径不破坏。
export type {
  ContextConfig,
} from '@/config/model-config'
export {
  MODEL_CONTEXT_LIMITS as DEFAULT_CONTEXT_CONFIGS,
  getContextConfig,
} from '@/config/model-config'

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

export function genericToOpenai(messages: GenericMessage[]): OpenAIMessage[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    tool_calls: msg.tool_calls,
    tool_call_id: msg.tool_call_id,
    reasoning_content: msg.reasoning_content,
  })) as OpenAIMessage[]
}

function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars * 1.5 + otherChars * 0.25)
}

export function estimateMessageTokens(messages: GenericMessage[] | OpenAIMessage[]): number {
  let total = 0

  for (const msg of messages) {
    total += 4
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content)
    }
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += estimateTokens(tc.function.name)
        const args = typeof tc.function.arguments === 'string'
          ? tc.function.arguments
          : JSON.stringify(tc.function.arguments)
        total += estimateTokens(args)
      }
    }
    if ('reasoning_content' in msg && msg.reasoning_content) {
      total += estimateTokens(msg.reasoning_content)
    }
    if ('tool_call_id' in msg && msg.tool_call_id) {
      total += 2
    }
  }

  return total
}

export interface CompressionResult<T = GenericMessage> {
  messages: T[]
  compressed: boolean
  originalTokens: number
  newTokens: number
  compressionRatio: number
  summary?: string
}

// Extended compression options including LLM config
export interface HybridCompressionOptions {
  keepRecentIterations?: number
  maxObservationLength?: number
  enableSummarization?: boolean
  preserveErrors?: boolean
  // LLM compression
  enableLLMCompression?: boolean
  llmOptions?: LLMCompressionOptions
}

function isErrorObservation(content: string): boolean {
  const errorIndicators = ['错误:', '失败', 'Error', 'error', 'exception', 'Exception', 'EXCEPTION', '失败:', 'timeout', '超时']
  return errorIndicators.some(indicator => content.includes(indicator))
}

function compressStepGroup(
  assistantMsg: GenericMessage,
  toolMsgs: GenericMessage[],
  preserveErrors: boolean = true
): { summary: string; success: boolean; hasError: boolean } {
  const thought = (assistantMsg.content as string) || ''
  const actions: string[] = []
  const observations: string[] = []
  let allSuccess = true
  let hasError = false

  if (assistantMsg.tool_calls) {
    for (const tc of assistantMsg.tool_calls) {
      actions.push(`${tc.function.name}(${tc.function.arguments.slice(0, 100)}...)`)
    }
  }

  for (const toolMsg of toolMsgs) {
    const content = (toolMsg.content as string) || ''
    const isError = isErrorObservation(content)
    if (isError) {
      allSuccess = false
      hasError = true
    }

    if (preserveErrors && isError) {
      observations.push(`[ERROR] ${content}`)
    } else {
      const truncatedObs = content.length > 200
        ? content.slice(0, 200) + '...'
        : content
      observations.push(isError ? `[ERROR] ${truncatedObs}` : truncatedObs)
    }
  }

  const summary = `[已压缩步骤]
思考: ${thought.slice(0, 150)}${thought.length > 150 ? '...' : ''}
行动: ${actions.join('; ')}
观察: ${observations.join('; ')}
结果: ${allSuccess ? '成功' : '失败'}`

  return { summary, success: allSuccess, hasError }
}

export function compressContext(
  messages: GenericMessage[],
  maxTokens: number,
  options: {
    keepRecentIterations?: number
    maxObservationLength?: number
    enableSummarization?: boolean
    preserveErrors?: boolean
  } = {}
): CompressionResult<GenericMessage> {
  const {
    keepRecentIterations = 3,
    maxObservationLength = 1000,
    enableSummarization = true,
    preserveErrors = true
  } = options

  const originalTokens = estimateMessageTokens(messages)

  if (originalTokens <= maxTokens) {
    return {
      messages,
      compressed: false,
      originalTokens,
      newTokens: originalTokens,
      compressionRatio: 1,
    }
  }

  const systemMessages = messages.filter(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')

  const iterations: Array<{ assistant: GenericMessage; tools: GenericMessage[] }> = []
  let currentIteration: { assistant: GenericMessage | null; tools: GenericMessage[] } = { assistant: null, tools: [] }
  let userMessages: GenericMessage[] = []

  for (const msg of conversationMessages) {
    if (msg.role === 'user') {
      if (currentIteration.assistant) {
        iterations.push({
          assistant: currentIteration.assistant,
          tools: [...currentIteration.tools]
        })
        currentIteration = { assistant: null, tools: [] }
      }
      userMessages.push(msg)
    } else if (msg.role === 'assistant') {
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

  if (currentIteration.assistant) {
    iterations.push({
      assistant: currentIteration.assistant,
      tools: [...currentIteration.tools]
    })
  }

  if (iterations.length === 0) {
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

  const recentIterations = iterations.slice(-keepRecentIterations)
  const oldIterations = iterations.slice(0, -keepRecentIterations)

  const newMessages: GenericMessage[] = [...systemMessages]

  if (userMessages.length > 0) {
    newMessages.push(userMessages[0])
  }

  if (oldIterations.length > 0 && enableSummarization) {
    const compressedSteps: string[] = []

    for (const iter of oldIterations) {
      const { summary } = compressStepGroup(iter.assistant, iter.tools, preserveErrors)
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

  for (const iter of recentIterations) {
    newMessages.push(iter.assistant)

    for (const toolMsg of iter.tools) {
      const content = (toolMsg.content as string) || ''
      const isError = isErrorObservation(content)
      
      if (preserveErrors && isError) {
        newMessages.push(toolMsg)
      } else if (typeof toolMsg.content === 'string' && toolMsg.content.length > maxObservationLength) {
        newMessages.push({
          ...toolMsg,
          content: toolMsg.content.slice(0, maxObservationLength) + '...[已截断]'
        })
      } else {
        newMessages.push(toolMsg)
      }
    }
  }

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

export function compressOpenAIContext(
  messages: OpenAIMessage[],
  maxTokens: number,
  options: {
    keepRecentIterations?: number
    maxObservationLength?: number
    enableSummarization?: boolean
    preserveErrors?: boolean
  } = {}
): CompressionResult<OpenAIMessage> {
  const genericMessages = openaiToGeneric(messages)
  const result = compressContext(genericMessages, maxTokens, options)
  return {
    ...result,
    messages: genericToOpenai(result.messages),
  }
}

export const compressOllamaContext = compressOpenAIContext

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
 * Hybrid compression with LLM support
 * Falls back to rule-based compression if LLM fails or is disabled
 */
export async function compressContextWithLLM(
  messages: GenericMessage[],
  maxTokens: number,
  options: HybridCompressionOptions = {}
): Promise<CompressionResult<GenericMessage>> {
  const {
    keepRecentIterations = 3,
    maxObservationLength = 1000,
    enableSummarization = true,
    preserveErrors = true,
    enableLLMCompression = false,
    llmOptions
  } = options

  const originalTokens = estimateMessageTokens(messages)

  // No compression needed
  if (originalTokens <= maxTokens) {
    return {
      messages,
      compressed: false,
      originalTokens,
      newTokens: originalTokens,
      compressionRatio: 1,
    }
  }

  // Extract iterations
  const systemMessages = messages.filter(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')

  const iterations: Array<{ assistant: GenericMessage; tools: GenericMessage[] }> = []
  let currentIteration: { assistant: GenericMessage | null; tools: GenericMessage[] } = { assistant: null, tools: [] }
  let userMessages: GenericMessage[] = []

  for (const msg of conversationMessages) {
    if (msg.role === 'user') {
      if (currentIteration.assistant) {
        iterations.push({
          assistant: currentIteration.assistant,
          tools: [...currentIteration.tools]
        })
        currentIteration = { assistant: null, tools: [] }
      }
      userMessages.push(msg)
    } else if (msg.role === 'assistant') {
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

  if (currentIteration.assistant) {
    iterations.push({
      assistant: currentIteration.assistant,
      tools: [...currentIteration.tools]
    })
  }

  // No iterations to compress
  if (iterations.length === 0) {
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

  const recentIterations = iterations.slice(-keepRecentIterations)
  const oldIterations = iterations.slice(0, -keepRecentIterations)

  const newMessages: GenericMessage[] = [...systemMessages]

  if (userMessages.length > 0) {
    newMessages.push(userMessages[0])
  }

  // Try LLM compression if enabled and we have old iterations
  let compressionSummary: string | null = null
  let usedLLM = false

  if (oldIterations.length > 0 && enableSummarization) {
    if (enableLLMCompression && llmOptions) {
      try {
        const compressor = new LLMCompressor(llmOptions)
        const result = await compressor.compressIterations(oldIterations)

        if (result.success && result.summary) {
          compressionSummary = result.summary
          usedLLM = true
        } else {
          // LLM failed, use rule-based fallback
          compressionSummary = generateRuleBasedSummary(oldIterations, preserveErrors)
        }
      } catch (error) {
        console.warn('[ContextCompressor] LLM compression failed, using rule-based:', error)
        compressionSummary = generateRuleBasedSummary(oldIterations, preserveErrors)
      }
    } else {
      // LLM not enabled, use rule-based
      compressionSummary = generateRuleBasedSummary(oldIterations, preserveErrors)
    }

    if (compressionSummary) {
      newMessages.push({
        role: 'user',
        content: `[上下文压缩摘要${usedLLM ? '（LLM生成）' : ''}]
以下是之前 ${oldIterations.length} 个步骤的压缩摘要：

${compressionSummary}

请基于以上历史继续执行任务。`
      })
    }
  }

  // Add recent iterations (unchanged)
  for (const iter of recentIterations) {
    newMessages.push(iter.assistant)

    for (const toolMsg of iter.tools) {
      const content = (toolMsg.content as string) || ''
      const isError = isErrorObservation(content)

      if (preserveErrors && isError) {
        newMessages.push(toolMsg)
      } else if (typeof toolMsg.content === 'string' && toolMsg.content.length > maxObservationLength) {
        newMessages.push({
          ...toolMsg,
          content: toolMsg.content.slice(0, maxObservationLength) + '...[已截断]'
        })
      } else {
        newMessages.push(toolMsg)
      }
    }
  }

  // Add remaining user messages
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
    summary: `压缩了 ${oldIterations.length} 个旧步骤，保留 ${recentIterations.length} 个最近步骤${usedLLM ? '（LLM压缩）' : ''}`,
  }
}

/**
 * Generate rule-based summary for iterations
 */
function generateRuleBasedSummary(
  iterations: Array<{ assistant: GenericMessage; tools: GenericMessage[] }>,
  preserveErrors: boolean
): string {
  const compressedSteps: string[] = []

  for (const iter of iterations) {
    const { summary } = compressStepGroup(iter.assistant, iter.tools, preserveErrors)
    compressedSteps.push(summary)
  }

  return compressedSteps.join('\n\n')
}

/**
 * Async hybrid compression for OpenAI messages
 */
export async function compressOpenAIContextWithLLM(
  messages: OpenAIMessage[],
  maxTokens: number,
  options: HybridCompressionOptions = {}
): Promise<CompressionResult<OpenAIMessage>> {
  const genericMessages = openaiToGeneric(messages)
  const result = await compressContextWithLLM(genericMessages, maxTokens, options)
  return {
    ...result,
    messages: genericToOpenai(result.messages),
  }
}
