/**
 * LLM-driven Context Compressor
 * Uses LLM to generate semantic summaries of conversation history
 */

import { OpenAIClient, type OpenAIMessage } from '../openai-client'
import type { GenericMessage } from './context-compressor'

export interface LLMCompressionOptions {
  model: string
  apiEndpoint: string
  apiKey?: string
  provider?: 'openai' | 'ollama'
}

export interface LLMCompressionResult {
  summary: string
  success: boolean
  error?: string
}

// System prompt for compression
const COMPRESSION_SYSTEM_PROMPT = `你是一个上下文压缩专家。你的任务是将 AI Agent 的执行历史压缩为简洁但信息丰富的摘要。

**压缩规则**:
1. 保留所有关键决策和推理过程
2. 保留重要的执行结果（成功/失败原因）
3. 丢弃冗余的细节，但保留上下文连贯性
4. 使用结构化格式输出
5. 摘要必须简洁，不超过 500 字符

**输出格式**（必须严格遵守）:
## 进展
[一句话描述当前任务进展]

## 关键决策
- [决策1]: [原因]
- [决策2]: [原因]

## 工具执行
- [工具名]: [结果摘要]

## 待解决
[如有未解决的问题，简要列出，无则写"无"]`

const COMPRESSION_USER_PROMPT = `请将以下 Agent 执行历史压缩为简洁摘要。保留关键信息，去除冗余细节。

---

{STEPS}

---

请生成压缩摘要（不超过 500 字符）：`

/**
 * LLM-based context compressor
 */
export class LLMCompressor {
  private client: OpenAIClient
  private model: string

  constructor(options: LLMCompressionOptions) {
    // For Ollama, use 'ollama' as API key (skips auth header)
    const apiKey = options.provider === 'ollama' ? 'ollama' : (options.apiKey || '')
    this.client = new OpenAIClient(apiKey, options.apiEndpoint)
    this.model = options.model
  }

  /**
   * Compress a group of ReAct iterations using LLM
   */
  async compressIterations(
    iterations: Array<{ assistant: GenericMessage; tools: GenericMessage[] }>
  ): Promise<LLMCompressionResult> {
    if (iterations.length === 0) {
      return { summary: '', success: true }
    }

    try {
      // Format iterations for compression
      const stepsText = this.formatIterationsForCompression(iterations)

      // Create compression prompt
      const messages: OpenAIMessage[] = [
        { role: 'system', content: COMPRESSION_SYSTEM_PROMPT },
        { role: 'user', content: COMPRESSION_USER_PROMPT.replace('{STEPS}', stepsText) }
      ]

      // Call LLM with timeout
      const response = await this.callWithTimeout(
        this.client.chat({
          model: this.model,
          messages,
          temperature: 0.3,
          max_tokens: 800,
        }),
        15000 // 15 second timeout
      )

      const summary = response.content.trim()

      if (!summary) {
        return {
          summary: this.fallbackCompression(iterations),
          success: false,
          error: 'LLM returned empty response'
        }
      }

      return { summary, success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        summary: this.fallbackCompression(iterations),
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Format iterations into text for compression
   */
  private formatIterationsForCompression(
    iterations: Array<{ assistant: GenericMessage; tools: GenericMessage[] }>
  ): string {
    const parts: string[] = []

    iterations.forEach((iter, index) => {
      const stepNum = index + 1
      let stepText = `### 步骤 ${stepNum}\n`

      // Add thought/reasoning
      if (iter.assistant.content) {
        stepText += `思考: ${iter.assistant.content}\n`
      }

      // Add tool calls
      if (iter.assistant.tool_calls && iter.assistant.tool_calls.length > 0) {
        const actions = iter.assistant.tool_calls.map(tc => {
          const args = typeof tc.function.arguments === 'string'
            ? tc.function.arguments.slice(0, 100)
            : JSON.stringify(tc.function.arguments).slice(0, 100)
          return `${tc.function.name}(${args}...)`
        })
        stepText += `行动: ${actions.join('; ')}\n`
      }

      // Add observations (tool results)
      if (iter.tools.length > 0) {
        const observations = iter.tools.map(t => {
          const content = typeof t.content === 'string' ? t.content : ''
          // Truncate long observations
          return content.length > 200 ? content.slice(0, 200) + '...' : content
        })
        stepText += `观察: ${observations.join('\n')}\n`
      }

      parts.push(stepText)
    })

    return parts.join('\n')
  }

  /**
   * Fallback to rule-based compression when LLM fails
   */
  private fallbackCompression(
    iterations: Array<{ assistant: GenericMessage; tools: GenericMessage[] }>
  ): string {
    const summaries: string[] = []

    iterations.forEach((iter, index) => {
      const thought = (iter.assistant.content as string || '').slice(0, 100)
      const actions = iter.assistant.tool_calls?.map(tc => tc.function.name).join(', ') || '无'
      const hasError = iter.tools.some(t => {
        const content = typeof t.content === 'string' ? t.content : ''
        return content.includes('错误') || content.includes('Error') || content.includes('失败')
      })

      summaries.push(`步骤${index + 1}: 思考="${thought}..." 行动=[${actions}] 结果=${hasError ? '失败' : '成功'}`)
    })

    return `[压缩失败，使用规则压缩]\n${summaries.join('\n')}`
  }

  /**
   * Call with timeout
   */
  private async callWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM compression timeout')), timeoutMs)
    })

    return Promise.race([promise, timeoutPromise])
  }
}

/**
 * Create LLM compressor from existing config
 */
export function createLLMCompressor(
  model: string,
  apiEndpoint: string,
  apiKey?: string,
  provider?: 'openai' | 'ollama'
): LLMCompressor | null {
  if (!model || !apiEndpoint) {
    return null
  }

  return new LLMCompressor({
    model,
    apiEndpoint,
    apiKey,
    provider: provider || 'openai'
  })
}
