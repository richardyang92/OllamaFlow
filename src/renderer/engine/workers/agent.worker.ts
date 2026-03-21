/**
 * Agent Worker - 完整的 Agent 执行器
 * 
 * 在 Web Worker 线程中执行，包含：
 * 1. 完整的 ReAct 执行循环
 * 2. LLM API 通信
 * 3. 上下文压缩
 * 4. 工具依赖分析
 * 5. 并行工具执行
 */

import type {
  MainToWorkerMessage,
  WorkerToMainMessage,
  AgentConfig,
  AgentStep,
  ToolCallInfo,
  ToolResult,
} from './types'

import type { GeneratedFileInfo } from '@/store/agent-store'
import { TodosManager } from '../tools'
import { OpenAIClient } from '../openai-client'
import type { OpenAIMessage, OpenAITool, OpenAIToolCall } from '../openai-client'
import { analyzeToolDependencies, type ToolCallWithIndex } from '../utils/tool-dependencies'
import {
  compressOpenAIContext,
  estimateMessageTokens,
  type GenericMessage,
} from '../react-agent/context-compressor'

// Worker 全局状态
let currentAgentId: string | null = null
let abortController: AbortController | null = null
let todosManager: TodosManager | null = null
let openaiClient: OpenAIClient | null = null

// 执行状态
let currentStep: AgentStep | null = null
let executionHistory: AgentStep[] = []
let generatedFiles: GeneratedFileInfo[] = []
let currentIteration = 0
let maxIterations = 10
let messages: OpenAIMessage[] = []

// 待处理的工具执行请求
const pendingToolExecutions = new Map<string, {
  resolve: (result: ToolResult) => void
  reject: (error: Error) => void
}>()

// ====== 消息处理 ======

self.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  const message = event.data
  
  switch (message.type) {
    case 'START_EXECUTION':
      handleStartExecution(message)
      break
    case 'CANCEL_EXECUTION':
      handleCancelExecution(message.agentId)
      break
    case 'TOOL_RESPONSE':
      handleToolResponse(message.requestId, message.result)
      break
    case 'USER_INPUT':
      handleUserInput(message.agentId, message.input)
      break
  }
}

// ====== 执行处理 ======

async function handleStartExecution(message: Extract<MainToWorkerMessage, { type: 'START_EXECUTION' }>) {
  const { agentId, config, userInput, continueParams } = message
  
  try {
    // 初始化状态
    currentAgentId = agentId
    abortController = new AbortController()
    todosManager = new TodosManager()
    openaiClient = new OpenAIClient(config.apiKey || '', config.baseURL)
    
    // 设置迭代参数
    if (continueParams) {
      currentIteration = continueParams.startIteration
      maxIterations = continueParams.maxIterations
      if (continueParams.existingFiles) {
        generatedFiles = [...continueParams.existingFiles]
      }
    } else {
      currentIteration = 0
      maxIterations = config.maxIterations || 10
      generatedFiles = []
    }
    
    executionHistory = []
    messages = []
    
    // 开始执行循环
    await executeAgentLoop(config, userInput)
    
  } catch (error) {
    if ((error as Error).message !== '执行已取消') {
      sendMessage({
        type: 'EXECUTION_ERROR',
        agentId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  } finally {
    cleanup()
  }
}

function handleCancelExecution(agentId: string) {
  if (currentAgentId === agentId && abortController) {
    abortController.abort()
    sendMessage({
      type: 'EXECUTION_ERROR',
      agentId,
      error: '执行已取消'
    })
  }
}

function handleToolResponse(requestId: string, result: ToolResult) {
  const pending = pendingToolExecutions.get(requestId)
  if (pending) {
    pendingToolExecutions.delete(requestId)
    pending.resolve(result)
  }
}

function handleUserInput(agentId: string, input: string) {
  if (currentAgentId === agentId) {
    // TODO: 处理用户输入，继续执行
    console.log('[Worker] Received user input:', input)
  }
}

// ====== 核心执行逻辑 ======

async function executeAgentLoop(config: AgentConfig, userInput: string): Promise<void> {
  // 初始化消息历史
  const systemPrompt = buildSystemPrompt(config)
  messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userInput }
  ]
  
  // 执行循环
  for (let iteration = currentIteration; iteration < maxIterations; iteration++) {
    // 检查是否被取消
    if (abortController?.signal.aborted) {
      throw new Error('执行已取消')
    }
    
    currentIteration = iteration + 1
    
    // 创建新的思考步骤
    const stepId = `step-${Date.now()}-${currentIteration}`
    currentStep = createStep(stepId, currentIteration, maxIterations)
    executionHistory.push(currentStep)
    
    sendMessage({
      type: 'STEP_START',
      agentId: currentAgentId!,
      step: currentStep
    })
    
    // 上下文压缩
    const compressedMessages = await compressMessagesIfNeeded(messages)
    
    // 调用 LLM（流式）
    const response = await callLLMStream(compressedMessages, config)
    
    // 更新思考完成
    sendMessage({
      type: 'STEP_UPDATE',
      agentId: currentAgentId!,
      stepId,
      update: {
        thoughtStreaming: false,
        thought: response.content
      }
    })
    
    // 检查是否有工具调用
    if (response.toolCalls && response.toolCalls.length > 0) {
      // 添加助手消息
      messages.push({
        role: 'assistant',
        content: response.content,
        tool_calls: response.toolCalls
      })
      
      // 更新步骤状态为 acting
      sendMessage({
        type: 'STEP_UPDATE',
        agentId: currentAgentId!,
        stepId,
        update: { status: 'acting' }
      })
      
      // 分析工具依赖关系，分组并行执行
      const toolCallGroups = analyzeToolDependencies(response.toolCalls)
      
      // 创建工具调用记录
      const toolCallRecords: ToolCallInfo[] = response.toolCalls.map((tc, idx) => ({
        id: tc.id || `tc_${Date.now()}_${idx}`,
        toolName: tc.function.name,
        toolType: tc.function.name.startsWith('workflow_') ? 'workflow' : 'builtin',
        input: parseToolArgs(tc.function.arguments)
      }))
      
      // 通知所有工具调用开始
      sendMessage({
        type: 'TOOL_CALLS_START',
        agentId: currentAgentId!,
        toolCalls: toolCallRecords
      })
      
      // 按组执行工具调用
      for (const group of toolCallGroups) {
        if (abortController?.signal.aborted) {
          throw new Error('执行已取消')
        }
        
        // 并行执行同一组内的工具
        const groupResults = await Promise.allSettled(
          group.map(({ toolCall, index }) =>
            executeToolCall(toolCall, toolCallRecords[index])
          )
        )
        
        // 收集结果
        for (let i = 0; i < groupResults.length; i++) {
          const result = groupResults[i]
          const { toolCall } = group[i]
          
          if (result.status === 'fulfilled') {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result.value
            })
          } else {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `执行错误: ${result.reason}`
            })
          }
        }
      }
      
      // 步骤完成
      sendMessage({
        type: 'STEP_UPDATE',
        agentId: currentAgentId!,
        stepId,
        update: {
          status: 'completed',
          completedAt: Date.now()
        }
      })
      
    } else {
      // 没有工具调用，执行完成
      sendMessage({
        type: 'STEP_UPDATE',
        agentId: currentAgentId!,
        stepId,
        update: {
          status: 'completed',
          completedAt: Date.now()
        }
      })
      
      sendMessage({
        type: 'EXECUTION_COMPLETE',
        agentId: currentAgentId!,
        response: response.content,
        generatedFiles
      })
      
      return
    }
  }
  
  // 达到最大迭代次数
  sendMessage({
    type: 'ITERATION_LIMIT',
    agentId: currentAgentId!,
    currentIteration,
    maxIterations
  })
}

// ====== LLM 调用 ======

async function callLLMStream(
  messages: OpenAIMessage[],
  config: AgentConfig
): Promise<{ content: string; toolCalls?: OpenAIToolCall[] }> {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized')
  }
  
  const tools = buildTools(config)
  
  let fullContent = ''
  let toolCalls: OpenAIToolCall[] | undefined
  let reasoningContent = ''
  
  try {
    const response = await openaiClient.chatStreamWithTools(
      {
        model: config.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
      },
      // onContentChunk
      (chunk) => {
        fullContent += chunk
        
        if (currentStep) {
          sendMessage({
            type: 'THOUGHT_CHUNK',
            agentId: currentAgentId!,
            stepId: currentStep.id,
            chunk
          })
          
          currentStep.thought += chunk
        }
      },
      // onToolCallName
      (toolName) => {
        console.log('[Worker] Tool call started:', toolName)
      },
      // onReasoningChunk
      (chunk) => {
        reasoningContent += chunk
      }
    )
    
    return {
      content: response.content,
      toolCalls: response.tool_calls
    }
    
  } catch (error) {
    console.error('[Worker] LLM call error:', error)
    throw error
  }
}

// ====== 工具执行 ======

async function executeToolCall(
  toolCall: OpenAIToolCall,
  toolCallInfo: ToolCallInfo
): Promise<string> {
  const requestId = generateId()
  
  // 发送工具执行请求到主线程
  sendMessage({
    type: 'TOOL_EXECUTE',
    requestId,
    agentId: currentAgentId!,
    toolCall: toolCallInfo
  })
  
  // 更新工具状态为 running
  sendMessage({
    type: 'TOOL_CALL_UPDATE',
    agentId: currentAgentId!,
    toolCallId: toolCallInfo.id,
    update: { status: 'running' }
  })
  
  // 等待主线程响应
  const result = await new Promise<ToolResult>((resolve, reject) => {
    pendingToolExecutions.set(requestId, { resolve, reject })
    
    // 设置超时（60秒）
    setTimeout(() => {
      if (pendingToolExecutions.has(requestId)) {
        pendingToolExecutions.delete(requestId)
        resolve({
          success: false,
          error: '工具执行超时'
        })
      }
    }, 60000)
  })
  
  // 更新工具状态
  sendMessage({
    type: 'TOOL_CALL_UPDATE',
    agentId: currentAgentId!,
    toolCallId: toolCallInfo.id,
    update: {
      status: result.success ? 'completed' : 'error',
      output: result.output,
      error: result.error,
      subAgentProgress: result.subAgentProgress
    }
  })
  
  // 处理 todos 更新
  if (toolCallInfo.toolName === 'todos' && result.success && todosManager) {
    const status = todosManager.getStatus()
    sendMessage({
      type: 'TODOS_UPDATE',
      agentId: currentAgentId!,
      items: status.items
    })
  }
  
  // 返回结果
  if (result.success) {
    return result.output || ''
  } else {
    return `错误: ${result.error}`
  }
}

// ====== 上下文压缩 ======

async function compressMessagesIfNeeded(
  messages: OpenAIMessage[]
): Promise<OpenAIMessage[]> {
  // 估算 token 数量
  const estimatedTokens = messages.reduce((sum, msg) => {
    return sum + estimateMessageTokens(msg as GenericMessage)
  }, 0)
  
  // 如果超过阈值（8000 tokens），进行压缩
  if (estimatedTokens > 8000) {
    console.log('[Worker] Compressing context, estimated tokens:', estimatedTokens)
    
    try {
      const compressed = await compressOpenAIContext(
        messages as GenericMessage[],
        {},
        4000 // 保留 4000 tokens
      )
      
      return compressed.messages as OpenAIMessage[]
    } catch (error) {
      console.error('[Worker] Context compression failed:', error)
      return messages
    }
  }
  
  return messages
}

// ====== 辅助函数 ======

function buildSystemPrompt(config: AgentConfig): string {
  let prompt = `You are a helpful AI assistant with access to various tools.

You can use the following tools to help the user:
- readFile: Read a file from the workspace
- writeFile: Write content to a file  
- executeCommand: Execute a shell command
- todos: Manage a todo list (init, add, complete, list, remove, clear)
- getCurrentDate: Get current date and time`
  
  if (config.workflows && config.workflows.length > 0) {
    prompt += `\n\nYou also have access to these workflows:\n`
    config.workflows.forEach(w => {
      prompt += `- workflow_${w.id}: ${w.name}\n`
    })
  }
  
  prompt += `\n\nWhen you need to use a tool, respond with a function call.
Think step by step and use tools when necessary to complete the task.`
  
  return prompt
}

function buildTools(config: AgentConfig): OpenAITool[] {
  const tools: OpenAITool[] = [
    {
      type: 'function',
      function: {
        name: 'readFile',
        description: 'Read a file from the workspace',
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the file (relative to workspace)'
            }
          },
          required: ['filePath']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'writeFile',
        description: 'Write content to a file',
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the file (relative to workspace)'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['filePath', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'executeCommand',
        description: 'Execute a shell command in the workspace',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Command to execute'
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 30000)'
            }
          },
          required: ['command']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'todos',
        description: 'Manage a todo list to track tasks and progress',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['init', 'add', 'complete', 'list', 'remove', 'clear'],
              description: 'Action to perform'
            },
            content: {
              type: 'string',
              description: 'Content for add/complete/remove actions'
            },
            taskId: {
              type: 'string',
              description: 'Task ID for complete/remove actions'
            },
            tasks: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of tasks for init action'
            }
          },
          required: ['action']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getCurrentDate',
        description: 'Get current date and time',
        parameters: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['full', 'date', 'time', 'timestamp'],
              description: 'Output format'
            }
          }
        }
      }
    }
  ]
  
  // 添加工作流工具
  if (config.workflows) {
    for (const workflow of config.workflows) {
      tools.push({
        type: 'function',
        function: {
          name: `workflow_${workflow.id}`,
          description: `Execute workflow: ${workflow.name}`,
          parameters: {
            type: 'object',
            properties: {
              input: {
                type: 'string',
                description: 'Input data for the workflow'
              }
            },
            required: ['input']
          }
        }
      })
    }
  }
  
  return tools
}

function createStep(id: string, iteration: number, maxIterations: number): AgentStep {
  return {
    id,
    iteration,
    maxIterations,
    status: 'thinking',
    thought: '',
    thoughtStreaming: true,
    observationStreaming: false,
    observationError: false,
    startedAt: Date.now()
  }
}

function parseToolArgs(argsString: string): Record<string, unknown> {
  try {
    return JSON.parse(argsString || '{}')
  } catch {
    return {}
  }
}

function sendMessage(message: WorkerToMainMessage): void {
  self.postMessage(message)
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function cleanup(): void {
  currentAgentId = null
  abortController = null
  todosManager = null
  openaiClient = null
  currentStep = null
  executionHistory = []
  pendingToolExecutions.clear()
  messages = []
}

// 通知主线程 Worker 已就绪
sendMessage({
  type: 'WORKER_READY',
  workerId: 'agent-worker'
})
