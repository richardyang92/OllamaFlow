import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, ReactAgentNodeData, ToolDefinition, ReActStep } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import type { Message, Tool } from 'ollama'
import { interpolateVariables } from '../executor'
import { Ollama } from 'ollama/browser'
import { executeTool, TodosManager, getEnabledTools } from '../tools'
import { useExecutionStore } from '@/store/execution-store'

// Tool parameter property type
interface ToolParamProperty {
  type?: string | string[]
  description?: string
  enum?: string[]
  items?: ToolParamProperty
}

// Get tool parameters schema based on tool type
function getToolParameters(toolType: string): {
  type: string
  properties: Record<string, ToolParamProperty>
  required: string[]
} {
  switch (toolType) {
    case 'todos':
      return {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['add', 'complete', 'list', 'remove', 'clear'],
            description: '操作类型'
          },
          content: { type: 'string', description: '任务内容' },
          taskId: { type: 'string', description: '任务ID' }
        },
        required: ['action']
      }
    case 'executeCommand':
      return {
        type: 'object',
        properties: {
          command: { type: 'string', description: '要执行的Shell命令' }
        },
        required: ['command']
      }
    case 'readFile':
      return {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '要读取的文件路径' }
        },
        required: ['filePath']
      }
    case 'writeFile':
      return {
        type: 'object',
        properties: {
          filename: { type: 'string', description: '文件路径' },
          content: { type: 'string', description: '文件内容' }
        },
        required: ['filename', 'content']
      }
    case 'httpRequest':
      return {
        type: 'object',
        properties: {
          url: { type: 'string', description: '请求URL' }
        },
        required: ['url']
      }
    default:
      return { type: 'object', properties: {}, required: [] }
  }
}

// Convert internal tool definitions to Ollama tools format
function convertToOllamaTools(tools: ToolDefinition[]): Tool[] {
  return tools.map(tool => {
    const params = getToolParameters(tool.type)
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: params.type,
          properties: params.properties,
          required: params.required
        }
      }
    }
  })
}

// Detect if the agent is stuck in a loop
function detectLoop(
  messages: Message[]
): { isLoop: boolean; loopType: string | null; suggestion: string | null; blockedActions: string[] } {
  // Extract tool calls from message history
  const toolCallsHistory: Array<{ name: string; result: string }> = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'assistant' && msg.tool_calls) {
      const tc = msg.tool_calls
      const toolNames = tc.map(t => t.function.name.toLowerCase())

      // Find corresponding tool response
      if (i + 1 < messages.length && messages[i + 1].role === 'tool') {
        toolCallsHistory.push({
          name: toolNames[0] || '',
          result: messages[i + 1].content
        })
      }
    }
  }

  if (toolCallsHistory.length < 2) {
    return { isLoop: false, loopType: null, suggestion: null, blockedActions: [] }
  }

  // Count how many times todos was used to add tasks
  const todosAddCount = toolCallsHistory.filter(
    (h) => h.name === 'todos' && h.result.includes('已添加任务')
  ).length

  if (todosAddCount > 2) {
    return {
      isLoop: true,
      loopType: 'overPlanning',
      suggestion: '你已经规划了足够的任务，现在必须立即执行实际操作！',
      blockedActions: ['todos']
    }
  }

  // Check if executeCommand was successful
  const execResults = toolCallsHistory.filter(h => h.name === 'executecommand')
  const lastExecResult = execResults.length > 0 ? execResults[execResults.length - 1] : null

  if (lastExecResult) {
    const successKeywords = ['saved', 'created', 'generated', 'success', 'complete', 'done', '完成', '成功', '保存', '生成', 'image saved']
    const hadSuccess = successKeywords.some(kw => lastExecResult.result.toLowerCase().includes(kw))

    if (hadSuccess) {
      const writeFileCount = toolCallsHistory.filter(
        (h, idx) => idx > toolCallsHistory.indexOf(lastExecResult) && h.name === 'writefile'
      ).length

      if (writeFileCount > 0) {
        return {
          isLoop: true,
          loopType: 'taskLikelyComplete',
          suggestion: '之前的命令执行已成功！请直接给出最终答案。',
          blockedActions: ['writefile']
        }
      }
    }
  }

  // Check for repeated writeFile
  const writeFileCount = toolCallsHistory.filter(h => h.name === 'writefile').length

  if (writeFileCount >= 2) {
    return {
      isLoop: true,
      loopType: 'repeatedWriteFile',
      suggestion: `你已经写入了 ${writeFileCount} 次文件。现在必须执行脚本或给出最终答案！`,
      blockedActions: ['writefile']
    }
  }

  // Check for repeated identical actions
  if (toolCallsHistory.length >= 3) {
    const recentActions = toolCallsHistory.slice(-3).map((h) => h.name)
    const firstAction = recentActions[0]
    const allSame = recentActions.every((a) => a === firstAction)

    if (allSame && firstAction) {
      return {
        isLoop: true,
        loopType: 'repeatedAction',
        suggestion: `你已经连续3次执行相同的操作。请使用不同的工具或给出最终答案。`,
        blockedActions: [firstAction]
      }
    }
  }

  return { isLoop: false, loopType: null, suggestion: null, blockedActions: [] }
}

export function createReactAgentExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as ReactAgentNodeData
      const vars = { ...context.variables, ...input }

      // Interpolate variables in prompts
      const systemPrompt = interpolateVariables(data.systemPrompt, vars)
      const userMessage = interpolateVariables(data.userMessage, vars)

      // Create Ollama instance
      const host = context.ollamaHost || 'http://localhost:11434'
      const ollamaInstance = new Ollama({ host })

      // Initialize TodosManager
      const todosManager = new TodosManager()

      // Get enabled tools
      const allTools = getEnabledTools(data.enabledTools || [])
      const ollamaTools = convertToOllamaTools(allTools)

      const maxIterations = data.maxIterations || 10

      let finalAnswer: string | null = null
      let iteration = 0

      // Initialize ReAct state in execution store
      const executionStore = useExecutionStore.getState()
      executionStore.initReActState(node.id, maxIterations)

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `开始 ReAct 智能体执行（Function Calling 模式），最大迭代: ${maxIterations}，工具: ${allTools.map(t => t.name).join(', ')}`,
      })

      // Build system prompt with rules
      const fullSystemPrompt = `${systemPrompt}

你拥有调用工具的能力来解决问题。当需要执行操作时，调用相应的工具函数。

重要规则：
1. 简单任务直接执行，复杂任务最多规划2-3步
2. 写入脚本后必须立即执行
3. 任务完成后直接给出最终答案，不要再调用工具

工具调用JSON格式要求：
- 工具参数必须是有效的JSON格式
- 如果参数包含代码字符串，代码中的反斜杠必须双写转义（例如 \\cos 变成 \\\\cos，\\n 变成 \\\\n）
- 确保所有字符串值中的特殊字符都正确转义`

      // Initialize messages using Ollama's Message type
      const messages: Message[] = [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: userMessage }
      ]

      while (iteration < maxIterations && !finalAnswer) {
        iteration++

        // Detect loop behavior
        const loopInfo = detectLoop(messages)

        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'debug',
          message: `[DEBUG] 迭代 ${iteration}/${maxIterations}, isLoop=${loopInfo.isLoop}, blockedActions=${loopInfo.blockedActions.join(',')}`,
        })

        // Create new step in ReAct state
        const stepId = `step-${iteration}-${Date.now()}`
        const newStep: ReActStep = {
          id: stepId,
          iteration,
          status: 'thinking',
          thought: '',
          thoughtStreaming: true,
          action: null,
          actionInput: null,
          observation: null,
          observationStreaming: false,
          observationError: false,
          startedAt: Date.now(),
        }
        executionStore.updateReActStep(node.id, newStep)

        // Get LLM response with retry for tool call parsing errors
        let response: Awaited<ReturnType<typeof ollamaInstance.chat>> | undefined
        let retryCount = 0
        const maxRetries = 2

        while (retryCount <= maxRetries) {
          try {
            response = await ollamaInstance.chat({
              model: data.model,
              messages: messages,
              tools: ollamaTools,
              options: {
                temperature: data.temperature,
                num_predict: data.maxTokens,
              },
              stream: false,
            })
            break // Success, exit retry loop
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)

            // Check if this is a tool call parsing error
            if (errorMessage.includes('error parsing tool call') || errorMessage.includes('invalid character')) {
              retryCount++

              if (retryCount <= maxRetries) {
                context.onLog?.({
                  nodeId: node.id,
                  nodeName: data.label,
                  level: 'warn',
                  message: `工具调用JSON解析失败，正在重试 (${retryCount}/${maxRetries})...`,
                })

                // Add a hint message to help the model fix the JSON
                messages.push({
                  role: 'user',
                  content: `上次工具调用失败，原因是JSON格式错误。请确保：
1. 代码中的反斜杠必须双写转义（例如 LaTeX 的 \\cos 写成 \\\\cos，换行符 \\n 写成 \\\\n）
2. 确保JSON字符串格式正确
请重新尝试调用工具，或直接给出答案。`
                })
                continue
              }
            }

            // Non-retryable error or max retries exceeded
            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'error',
              message: `Ollama 请求失败: ${errorMessage}`,
            })
            throw error
          }
        }

        // Response should be defined at this point (error would have been thrown otherwise)
        if (!response) {
          throw new Error('Failed to get response from Ollama')
        }

        const content = response.message.content || ''
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'debug',
          message: `[DEBUG] LLM响应: content=${content.slice(0, 100)}..., tool_calls=${response.message.tool_calls?.length || 0}`,
        })

        // Add assistant response to messages
        messages.push(response.message)

        // Update step with thought
        const thought = content || '(思考中...)'
        executionStore.updateReActStep(node.id, {
          id: stepId,
          thought,
          thoughtStreaming: false,
        })

        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `思考: ${thought.slice(0, 200)}${thought.length > 200 ? '...' : ''}`,
        })

        // Check if no tool calls - means final answer
        if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
          finalAnswer = content || '任务完成'

          executionStore.updateReActStep(node.id, {
            id: stepId,
            status: 'completed',
          })
          executionStore.completeReActStep(node.id, stepId)
          executionStore.setReActFinalAnswer(node.id, finalAnswer)

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: `达到最终答案`,
          })

          if (data.stream) {
            context.onStream?.(node.id, `\n✅ 最终答案: ${finalAnswer}\n`)
          }
          break
        }

        // Process tool calls
        for (const toolCall of response.message.tool_calls) {
          const toolName = toolCall.function.name
          const toolArgs = toolCall.function.arguments

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: `调用工具: ${toolName}`,
          })

          // Update step status to acting
          executionStore.updateReActStep(node.id, {
            id: stepId,
            status: 'acting',
            action: toolName,
            actionInput: JSON.stringify(toolArgs),
          })

          // Check if this action is blocked
          if (loopInfo.blockedActions.includes(toolName.toLowerCase())) {
            const blockedObservation = `🚫 操作被阻止: ${loopInfo.suggestion || '此操作已被阻止'}`

            messages.push({ role: 'tool', content: blockedObservation })

            executionStore.updateReActStep(node.id, {
              id: stepId,
              status: 'error',
              observation: blockedObservation,
              observationError: true,
            })
            executionStore.completeReActStep(node.id, stepId)

            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'warn',
              message: blockedObservation,
            })

            if (data.stream) {
              context.onStream?.(node.id, `🚫 ${blockedObservation}\n`)
            }
            continue
          }

          // Find and execute the tool
          const tool = allTools.find(t => t.name === toolName)

          if (!tool) {
            const errorObs = `错误: 未知工具 "${toolName}"。可用工具: ${allTools.map(t => t.name).join(', ')}`

            messages.push({ role: 'tool', content: errorObs })

            executionStore.updateReActStep(node.id, {
              id: stepId,
              status: 'error',
              observation: errorObs,
              observationError: true,
            })
            executionStore.completeReActStep(node.id, stepId)

            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'warn',
              message: errorObs,
            })

            if (data.stream) {
              context.onStream?.(node.id, `❌ ${errorObs}\n`)
            }
            continue
          }

          // Execute the tool
          executionStore.updateReActStep(node.id, {
            id: stepId,
            status: 'observing',
          })

          if (data.stream) {
            const argsPreview = JSON.stringify(toolArgs).slice(0, 100)
            context.onStream?.(node.id, `🔧 调用: ${toolName}\n📥 参数: ${argsPreview}...\n`)
          }

          try {
            // executeTool expects string input, convert toolArgs to JSON string
            const result = await executeTool(
              tool,
              toolArgs,
              context,
              todosManager
            )

            let observation = result.success ? result.output : `错误: ${result.error}`

            // Add hints based on tool type
            if (tool.name.toLowerCase() === 'writefile' && result.success) {
              const fileMatch = observation.match(/文件已写入:?\s*([^\n💡]+)/i)
              const filePath = fileMatch ? fileMatch[1].trim() : ''
              const ext = filePath.split('.').pop()?.toLowerCase()
              const scriptExts = ['py', 'js', 'ts', 'sh', 'bat', 'ps1', 'rb', 'php']
              if (ext && scriptExts.includes(ext)) {
                const runCmd = ext === 'py' ? `python ${filePath}` :
                               ext === 'js' ? `node ${filePath}` :
                               ext === 'ts' ? `npx ts-node ${filePath}` :
                               ext === 'sh' ? `bash ${filePath}` :
                               ext === 'bat' || ext === 'ps1' ? filePath :
                               filePath
                observation += `\n💡 提示: 下一步用 executeCommand 执行: ${runCmd}`
              }
            }

            if (tool.name.toLowerCase() === 'executecommand' && result.success) {
              const successKeywords = ['saved', 'created', 'generated', 'success', 'complete', 'done', '完成', '成功', '保存', '生成']
              const hasSuccessKeyword = successKeywords.some(kw => observation.toLowerCase().includes(kw))
              if (hasSuccessKeyword) {
                observation += `\n✅ 任务完成！可以给出最终答案了。`
              }
            }

            messages.push({ role: 'tool', content: observation })

            executionStore.updateReActStep(node.id, {
              id: stepId,
              observation,
              observationError: !result.success,
            })
            executionStore.completeReActStep(node.id, stepId)

            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: result.success ? 'info' : 'error',
              message: `观察: ${observation.slice(0, 200)}${observation.length > 200 ? '...' : ''}`,
            })

            if (data.stream) {
              const truncatedObs = observation.length > 500
                ? observation.slice(0, 500) + '...'
                : observation
              context.onStream?.(node.id, `👁 观察: ${truncatedObs}\n`)
            }
          } catch (error) {
            const errorObs = `工具执行错误: ${(error as Error).message}`

            messages.push({ role: 'tool', content: errorObs })

            executionStore.updateReActStep(node.id, {
              id: stepId,
              status: 'error',
              observation: errorObs,
              observationError: true,
            })
            executionStore.completeReActStep(node.id, stepId)

            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'error',
              message: errorObs,
            })

            if (data.stream) {
              context.onStream?.(node.id, `❌ ${errorObs}\n`)
            }
          }
        }
      }

      if (!finalAnswer) {
        finalAnswer = `在 ${maxIterations} 次迭代后未能得出最终答案。`
        executionStore.setReActFinalAnswer(node.id, finalAnswer)
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'warn',
          message: `达到最大迭代次数，未获得最终答案`,
        })
        if (data.stream) {
          context.onStream?.(node.id, `\n⚠️ 达到最大迭代次数\n`)
        }
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `ReAct 智能体执行完成，迭代次数: ${iteration}`,
      })

      return {
        response: finalAnswer,
      }
    },
  }
}
