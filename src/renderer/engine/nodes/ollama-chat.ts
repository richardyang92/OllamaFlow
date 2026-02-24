import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, OllamaChatNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'
import { Ollama } from 'ollama/browser'
import { OpenAIClient, OpenAIMessage } from '../openai-client'

/**
 * Execute chat using OpenAI API (Debug Mode)
 */
async function executeWithOpenAI(
  node: Node<WorkflowNodeData>,
  data: OllamaChatNodeData,
  systemPrompt: string,
  userMessage: string,
  context: ExecutionContext
): Promise<unknown> {
  const debugMode = data.debugMode!

  // Get API key from secure storage or use the one provided
  let apiKey = debugMode.apiKey
  if (!apiKey) {
    // Try node-specific key first
    const storedKey = await window.electronAPI.openai.getApiKey(`ollama-${node.id}`)
    if (storedKey) {
      apiKey = storedKey
    } else {
      // Fall back to workspace default key
      const workspaceKey = await window.electronAPI.openai.getApiKey('workspace-default')
      if (workspaceKey) {
        apiKey = workspaceKey
      }
    }
  }

  if (!apiKey) {
    throw new Error('OpenAI API Key 未配置。请在调试模式设置中输入 API Key，或在向导中配置工作区默认 API Key。')
  }

  const client = new OpenAIClient(apiKey, debugMode.apiEndpoint)

  const messages: OpenAIMessage[] = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    { role: 'user' as const, content: userMessage },
  ]

  context.onLog?.({
    nodeId: node.id,
    nodeName: data.label,
    level: 'info',
    message: `使用 OpenAI API (Debug Mode): ${debugMode.model}`,
  })

  try {
    if (data.stream) {
      // Handle streaming response
      let fullResponse = ''
      let chunkCount = 0

      for await (const chunk of client.chatStream({
        model: debugMode.model,
        messages,
        temperature: data.temperature,
        max_tokens: data.maxTokens,
      })) {
        chunkCount++
        fullResponse += chunk
        context.onStream?.(node.id, chunk)
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: 'OpenAI response completed',
        data: { fullResponse, chunkCount },
      })

      return {
        response: fullResponse,
        model: debugMode.model,
        provider: 'openai',
      }
    } else {
      // Handle non-streaming response
      const result = await client.chat({
        model: debugMode.model,
        messages,
        temperature: data.temperature,
        max_tokens: data.maxTokens,
      })

      const content = result.content || ''

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: 'OpenAI response received',
        data: { content, hasContent: !!content },
      })

      return {
        response: content,
        model: debugMode.model,
        provider: 'openai',
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    context.onLog?.({
      nodeId: node.id,
      nodeName: data.label,
      level: 'error',
      message: `OpenAI 请求失败: ${errorMessage}`,
    })
    throw error
  }
}

/**
 * Execute chat using Ollama API (Default)
 */
async function executeWithOllama(
  node: Node<WorkflowNodeData>,
  data: OllamaChatNodeData,
  systemPrompt: string,
  userMessage: string,
  context: ExecutionContext
): Promise<unknown> {
  // Create Ollama instance with custom host if provided
  const host = context.ollamaHost || 'http://localhost:11434'
  const ollamaInstance = new Ollama({ host })

  const messages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    { role: 'user', content: userMessage },
  ]

  const options = {
    temperature: data.temperature,
    top_p: data.topP,
    num_predict: data.maxTokens,
  }

  if (data.stream) {
    // Handle streaming response
    let fullResponse = ''
    const stream = await ollamaInstance.chat({
      model: data.model,
      messages,
      options,
      stream: true,
    })

    let chunkCount = 0
    for await (const chunk of stream) {
      chunkCount++

      if (chunk.message?.content) {
        const content = chunk.message.content
        fullResponse += content
        context.onStream?.(node.id, content)
      }
    }

    context.onLog?.({
      nodeId: node.id,
      nodeName: data.label,
      level: 'info',
      message: 'Ollama response completed',
      data: { fullResponse, chunkCount },
    })

    return {
      response: fullResponse,
      model: data.model,
      provider: 'ollama',
    }
  } else {
    // Handle non-streaming response
    const result = await ollamaInstance.chat({
      model: data.model,
      messages,
      options,
      stream: false,
    })

    const content = result.message?.content || ''

    context.onLog?.({
      nodeId: node.id,
      nodeName: data.label,
      level: 'info',
      message: 'Ollama response received',
      data: { content, hasContent: !!content },
    })

    return {
      response: content,
      model: data.model,
      provider: 'ollama',
    }
  }
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

      try {
        // Check if debug mode is enabled with OpenAI
        if (data.debugMode?.enabled) {
          return executeWithOpenAI(node, data, systemPrompt, userMessage, context)
        }

        // Default: Execute with Ollama
        return executeWithOllama(node, data, systemPrompt, userMessage, context)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'error',
          message: `请求失败: ${errorMessage}`,
        })
        throw error
      }
    },
  }
}
