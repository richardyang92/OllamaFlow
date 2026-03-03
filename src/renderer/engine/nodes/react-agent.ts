import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, ReactAgentNodeData, ToolDefinition, ReActStep } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import type { Message, Tool } from 'ollama'
import { interpolateVariables } from '../executor'
import { Ollama } from 'ollama/browser'
import { executeTool, TodosManager, getEnabledTools } from '../tools'
import { useExecutionStore } from '@/store/execution-store'
import { OpenAIClient, OpenAIMessage, parseToolCallArgs } from '../openai-client'

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
            enum: ['init', 'add', 'complete', 'list', 'remove', 'clear'],
            description: '操作类型。推荐使用init一次性创建多个任务'
          },
          tasks: {
            type: 'array',
            items: { type: 'string' },
            description: '任务列表数组（用于init操作，一次性创建多个任务）'
          },
          content: { type: 'string', description: '任务内容（用于add/complete/remove操作）' },
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
    // Browser tools
    case 'browser_navigate':
      return {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要导航的URL地址（如 https://example.com）' }
        },
        required: ['url']
      }
    case 'browser_click':
      return {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS选择器（如 "button.submit", "#login-btn", "a[href*=login]"）' },
          clickCount: { type: 'number', description: '点击次数，2表示双击（可选）' }
        },
        required: ['selector']
      }
    case 'browser_type':
      return {
        type: 'object',
        properties: {
          selector: { type: 'string', description: '输入框的CSS选择器' },
          text: { type: 'string', description: '要输入的文本内容' },
          clear: { type: 'boolean', description: '是否先清空输入框（可选，默认false）' }
        },
        required: ['selector', 'text']
      }
    case 'browser_scroll':
      return {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down'], description: '滚动方向' },
          amount: { type: 'number', description: '滚动像素数（可选，默认300）' }
        },
        required: ['direction']
      }
    case 'browser_screenshot':
      return {
        type: 'object',
        properties: {
          fullPage: { type: 'boolean', description: '是否截取完整页面（可选）' },
          selector: { type: 'string', description: '指定元素的CSS选择器（可选）' }
        },
        required: []
      }
    case 'browser_getContent':
      return {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['text', 'html'], description: '内容格式' },
          selector: { type: 'string', description: '指定元素的CSS选择器，不填则获取整个页面（可选）' },
          maxLength: { type: 'number', description: '最大字符数限制（可选）' }
        },
        required: ['format']
      }
    case 'browser_evaluate':
      return {
        type: 'object',
        properties: {
          script: { type: 'string', description: '要执行的JavaScript代码' }
        },
        required: ['script']
      }
    case 'browser_wait':
      return {
        type: 'object',
        properties: {
          selector: { type: 'string', description: '等待的元素CSS选择器' },
          timeout: { type: 'number', description: '超时时间（毫秒，可选，默认5000）' }
        },
        required: ['selector']
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

  // Count how many times todos was used to add tasks (only 'add', not 'init')
  const todosAddCount = toolCallsHistory.filter(
    (h) => h.name === 'todos' && h.result.includes('已添加任务')
  ).length

  // Check if init was already called
  const hasInitCall = toolCallsHistory.some(
    (h) => h.name === 'todos' && h.result.includes('已创建')
  )

  // Block todos 'add' if init was already called and user tries to add more
  if (hasInitCall && todosAddCount > 0) {
    return {
      isLoop: true,
      loopType: 'postInitAdding',
      suggestion: '任务列表已创建，请开始执行任务而不是继续添加！',
      blockedActions: ['todos']
    }
  }

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

      // Check if debug mode is enabled with OpenAI
      if (data.debugMode?.enabled) {
        return executeReActWithOpenAI(node, data, input, context)
      }

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
      executionStore.initReActState(context.executionId, node.id, maxIterations)

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `开始 ReAct 智能体执行（Function Calling 模式），最大迭代: ${maxIterations}，工具: ${allTools.map(t => t.name).join(', ')}`,
      })

      // Build system prompt with rules
      const fullSystemPrompt = `${systemPrompt}

## 你的能力
你是一个 ReAct 智能体，遵循"思考-行动-观察"循环来解决问题。
你可以调用工具来执行实际操作，不要只靠想象给出答案。

## 可用工具

### todos - 任务规划工具
用于规划和追踪复杂任务的执行步骤。
- **推荐**: 一次性创建任务列表: {"action": "init", "tasks": ["任务1", "任务2", "任务3"]}
- 添加单个任务: {"action": "add", "content": "任务描述"}
- 完成任务: {"action": "complete", "content": "任务关键词"}
- 查看列表: {"action": "list"}
- 清空列表: {"action": "clear"}

### executeCommand - 执行命令
执行 Shell 命令（如 python、node、curl 等）。
输入: {"command": "python script.py"}

### readFile - 读取文件
读取工作区中的文件内容。
输入: {"filePath": "data/input.txt"}

### writeFile - 写入文件
将内容写入工作区文件（代码、数据、结果等）。
输入: {"filename": "output.py", "content": "print('hello')"}

### httpRequest - HTTP请求
发送 HTTP 请求获取网页或 API 数据。
输入: {"url": "https://api.example.com"}

### 浏览器自动化工具
用于控制浏览器执行网页操作。

#### browser_navigate - 导航到网页
打开指定URL的网页。
输入: {"url": "https://example.com"}

#### browser_click - 点击元素
点击页面上的元素（按钮、链接等）。
输入: {"selector": "button.submit"} 或 {"selector": "#login-btn"}
CSS选择器示例: "button.primary", "a[href*=login]", ".submit-btn"

#### browser_type - 输入文本
在输入框中输入文本。
输入: {"selector": "input[name=q]", "text": "搜索内容", "clear": true}
- clear: 可选，是否先清空输入框

#### browser_scroll - 滚动页面
向上或向下滚动页面。
输入: {"direction": "down", "amount": 500}
- direction: "up" 或 "down"
- amount: 可选，滚动像素数，默认300

#### browser_screenshot - 截图
截取当前页面的截图。
输入: {"fullPage": true} 或 {"selector": ".main-content"}

#### browser_getContent - 获取页面内容
获取页面的文本或HTML内容。
输入: {"format": "text"} 或 {"format": "html", "selector": ".article", "maxLength": 5000}
- format: "text" 或 "html"
- selector: 可选，获取特定元素
- maxLength: 可选，限制内容长度

#### browser_evaluate - 执行JavaScript
在页面中执行JavaScript代码。
输入: {"script": "document.title"}
可以执行更复杂的脚本获取页面数据。

#### browser_wait - 等待元素
等待指定元素出现在页面上。
输入: {"selector": ".result", "timeout": 5000}

## 工作流程（ReAct循环）

1. **思考** (Think): 分析任务，决定下一步行动
2. **行动** (Act): 调用合适的工具执行操作
3. **观察** (Observe): 查看工具返回的结果
4. **重复**: 直到任务完成

## 任务执行指南

### 何时使用 todos 规划？
- 任务需要3个以上步骤
- 任务包含多个子任务
- 需要按顺序完成多个操作
- 示例：搜索新闻 → 阅读内容 → 提取要点 → 写总结

### 如何使用 todos.init 一次性规划？
**推荐做法**: 使用 init 一次性创建所有任务
行动: {"action": "init", "tasks": ["步骤1描述", "步骤2描述", "步骤3描述", ...]}

**不推荐**: 多次调用 add 添加任务（浪费迭代次数）
行动: {"action": "add", "content": "步骤1"}  ← 不要这样做

### 如何正确执行任务？

**错误示范**: 直接给出答案，不调用任何工具
你: 我无法完成这个任务...（错误！应该先尝试使用可用工具）

**正确做法**: 使用工具逐步执行
思考: 这是一个需要实际操作的任务，我应该先规划步骤，然后调用工具执行
行动: 先用 todos.init 创建任务列表，再逐步调用合适的工具完成每一步

## 🚨 核心执行流程（必须严格遵守）

### 标准执行流程
1. **规划阶段**: 用 todos.init 一次性创建所有任务
2. **执行阶段**: 按顺序执行每个任务
   - 调用工具完成当前任务（如 httpRequest、executeCommand、writeFile 等）
   - **立即调用 todos.complete 标记任务完成**
   - 再执行下一个任务
3. **完成阶段**: 所有任务完成后给出最终答案

### ⚠️ 必须遵守的规则
1. **每完成一个任务，必须立即调用 todos.complete**
   - 执行完工具后，观察结果如果成功，立即: {"action": "complete", "content": "任务关键词"}
   - 然后再继续下一个任务
2. **按顺序执行任务**，不要跳过或乱序
3. **每个任务只能标记完成一次**

### 示例执行流程
---示例开始---
任务列表: ["获取热搜数据", "解析内容", "生成文章"]

迭代1: todos.init → 创建3个任务
迭代2: httpRequest 获取数据 → 观察成功 → todos.complete "获取热搜数据"
迭代3: 解析内容（或调用工具）→ 观察成功 → todos.complete "解析内容"
迭代4: writeFile 生成文章 → 观察成功 → todos.complete "生成文章"
迭代5: 所有任务完成 → 给出最终答案（不再调用工具）
---示例结束---

## 重要规则

1. **多步任务先用 todos 规划** - 添加任务列表后再逐步执行
2. **必须调用工具执行实际操作** - 不要空想，要行动
3. **完成一步立即标记** - 每完成一个任务必须调用 todos.complete
4. **按顺序执行** - 按任务列表顺序逐个完成
5. **写入脚本后立即执行** - 用 writeFile 写代码后，用 executeCommand 运行
6. **每次只调用一个工具** - 等待观察结果后再决定下一步
7. **所有任务完成后给出最终答案** - 不再调用工具，直接回答

## 💬 用户交互（可选）

${data.enableUserInput ? `
当你在执行任务过程中需要用户确认、提供更多信息或做出选择时，可以使用用户交互功能。

**何时使用**：
- 需要用户确认是否继续执行某个操作
- 需要用户提供额外的信息（如 API Key、配置参数等）
- 遇到多个可行方案，需要用户选择
- 任务执行前需要用户确认计划

**如何使用**：
在你的思考或回答中，使用以下格式：
\`\`\`
WAIT_FOR_INPUT: 你的问题
\`\`\`

**示例**：
\`\`\`
思考: 我需要访问某个 API，但需要用户提供 API Key。

WAIT_FOR_INPUT: 我需要访问天气 API，请提供您的 API Key
\`\`\`

或者：
\`\`\`
思考: 我找到了两种方案来完成任务，需要用户选择。

WAIT_FOR_INPUT: 我找到了两种方案：
1. 使用 Python 脚本处理（速度快，但需要安装依赖）
2. 使用在线 API 处理（无需安装，但速度较慢）
请选择方案（输入 1 或 2）
\`\`\`

**注意事项**：
- 等待用户输入后，你会收到用户的回复，然后继续执行
- 不要过度使用，仅在确实需要用户参与时使用
- 提问要清晰明确，避免模糊不清
- 用户输入后，你可以基于用户的回复继续执行任务
` : '（用户交互功能未启用）'}

## JSON格式提醒
- 代码中的反斜杠必须双写转义（\\\\cos -> \\\\\\\\cos，\\\\n -> \\\\\\\\n）
- 确保所有字符串正确转义`

      // Initialize messages using Ollama's Message type
      const messages: Message[] = [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: userMessage }
      ]

      while (iteration < maxIterations && !finalAnswer) {
        // Check if execution was cancelled
        if (context.signal?.aborted) {
          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: 'ReAct Agent 执行已取消',
          })
          break
        }

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
        executionStore.updateReActStep(context.executionId, node.id, newStep)

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
        executionStore.updateReActStep(context.executionId, node.id, {
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

        // Check if no tool calls - means final answer or waiting for user input
        if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
          // Check if the response contains WAIT_FOR_INPUT marker
          if (data.enableUserInput && content.includes('WAIT_FOR_INPUT:')) {
            const promptMatch = content.match(/WAIT_FOR_INPUT:\s*(.+?)(?:\n|$)/s)
            const promptText = promptMatch ? promptMatch[1].trim() : '请提供更多信息'
            
            const contextText = content.replace(/WAIT_FOR_INPUT:.*$/s, '').trim()
            
            executionStore.setReActWaitingForInput(context.executionId, node.id, promptText, contextText)
            
            executionStore.updateReActStep(context.executionId, node.id, {
              id: stepId,
              status: 'completed',
              thought: content,
              thoughtStreaming: false,
            })
            executionStore.completeReActStep(context.executionId, node.id, stepId)
            
            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'info',
              message: `等待用户输入: ${promptText}`,
            })
            
            if (data.stream) {
              context.onStream?.(node.id, `\n⏸️ 等待用户输入: ${promptText}\n`)
            }
            
            return {
              status: 'waiting',
              prompt: promptText,
              context: contextText,
            }
          }
          
          finalAnswer = content || '任务完成'

          executionStore.updateReActStep(context.executionId, node.id, {
            id: stepId,
            status: 'completed',
          })
          executionStore.completeReActStep(context.executionId, node.id, stepId)
          executionStore.setReActFinalAnswer(context.executionId, node.id, finalAnswer)

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
          executionStore.updateReActStep(context.executionId, node.id, {
            id: stepId,
            status: 'acting',
            action: toolName,
            actionInput: JSON.stringify(toolArgs),
          })

          // Check if this action is blocked
          if (loopInfo.blockedActions.includes(toolName.toLowerCase())) {
            const blockedObservation = `🚫 操作被阻止: ${loopInfo.suggestion || '此操作已被阻止'}`

            messages.push({ role: 'tool', content: blockedObservation })

            executionStore.updateReActStep(context.executionId, node.id, {
              id: stepId,
              status: 'error',
              observation: blockedObservation,
              observationError: true,
            })
            executionStore.completeReActStep(context.executionId, node.id, stepId)

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

            executionStore.updateReActStep(context.executionId, node.id, {
              id: stepId,
              status: 'error',
              observation: errorObs,
              observationError: true,
            })
            executionStore.completeReActStep(context.executionId, node.id, stepId)

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
          executionStore.updateReActStep(context.executionId, node.id, {
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

            // Sync todos state to store after each tool execution
            const todosStatus = todosManager.getStatus()
            executionStore.updateReActTodos(context.executionId, node.id, todosStatus.items)

            let observation = result.success ? result.output : `错误: ${result.error}`

            // Add hints based on tool type
            if (tool.name.toLowerCase() === 'writefile' && result.success) {
              const fileMatch = observation.match(/文件已写入:?\s*([^\n💡]+)/iu)
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

            // Add task status hint after tool execution (except for todos tool itself)
            if (result.success && tool.name.toLowerCase() !== 'todos') {
              const currentTodos = todosManager.getStatus()
              if (currentTodos.total > 0 && currentTodos.pending > 0) {
                const pendingTasks = currentTodos.items.filter(t => !t.completed)
                const completedCount = currentTodos.completed

                // Find the first pending task as the current task
                const currentTask = pendingTasks[0]

                observation += `\n\n📋 当前进度: ${completedCount}/${currentTodos.total} 任务完成`
                observation += `\n📌 下一步操作: 请用 {"action": "complete", "content": "${currentTask?.content.slice(0, 30)}"} 标记任务完成，然后继续执行下一个任务`
              }
            }

            // After todos.complete, show next task hint
            if (tool.name.toLowerCase() === 'todos' && result.success && observation.includes('已完成任务')) {
              const currentTodos = todosManager.getStatus()
              if (currentTodos.pending > 0) {
                const pendingTasks = currentTodos.items.filter(t => !t.completed)
                const nextTask = pendingTasks[0]
                observation += `\n\n🎯 下一个任务: ${nextTask?.content}`
                observation += `\n💡 请立即执行此任务，完成后标记为完成`
              } else if (currentTodos.total > 0 && currentTodos.pending === 0) {
                observation += `\n\n✅ 所有任务已完成！现在可以给出最终答案了。`
              }
            }

            // After todos.init, show first task hint
            if (tool.name.toLowerCase() === 'todos' && result.success && observation.includes('已创建')) {
              const currentTodos = todosManager.getStatus()
              if (currentTodos.pending > 0) {
                const pendingTasks = currentTodos.items.filter(t => !t.completed)
                const firstTask = pendingTasks[0]
                observation += `\n\n🎯 现在开始执行第一个任务: ${firstTask?.content}`
                observation += `\n💡 请立即调用工具执行此任务，完成后用 todos.complete 标记`
              }
            }

            messages.push({ role: 'tool', content: observation })

            executionStore.updateReActStep(context.executionId, node.id, {
              id: stepId,
              observation,
              observationError: !result.success,
            })
            executionStore.completeReActStep(context.executionId, node.id, stepId)

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

            executionStore.updateReActStep(context.executionId, node.id, {
              id: stepId,
              status: 'error',
              observation: errorObs,
              observationError: true,
            })
            executionStore.completeReActStep(context.executionId, node.id, stepId)

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
        executionStore.setReActFinalAnswer(context.executionId, node.id, finalAnswer)
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

/**
 * Execute ReAct with OpenAI API (Debug Mode)
 */
async function executeReActWithOpenAI(
  node: Node<WorkflowNodeData>,
  data: ReactAgentNodeData,
  input: Record<string, unknown>,
  context: ExecutionContext
): Promise<unknown> {
  const vars = { ...context.variables, ...input }
  const debugMode = data.debugMode!

  // Interpolate variables in prompts
  const systemPrompt = interpolateVariables(data.systemPrompt, vars)
  const userMessage = interpolateVariables(data.userMessage, vars)

  // Get API key from secure storage or use the one provided
  let apiKey = debugMode.apiKey
  if (!apiKey) {
    // Try node-specific key first
    const storedKey = await window.electronAPI.openai.getApiKey(`react-${node.id}`)
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

  // Initialize TodosManager
  const todosManager = new TodosManager()

  // Get enabled tools and convert to OpenAI format
  const allTools = getEnabledTools(data.enabledTools || [])
  const openaiTools = allTools.map(tool => {
    const params = getToolParameters(tool.type)
    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: params.type,
          properties: params.properties as Record<string, unknown>,
          required: params.required
        }
      }
    }
  })

  const maxIterations = data.maxIterations || 10
  let finalAnswer: string | null = null
  let iteration = 0

  // Initialize ReAct state in execution store
  const executionStore = useExecutionStore.getState()
  executionStore.initReActState(context.executionId, node.id, maxIterations)

  context.onLog?.({
    nodeId: node.id,
    nodeName: data.label,
    level: 'info',
    message: `开始 ReAct 智能体执行 (OpenAI Debug Mode)，最大迭代: ${maxIterations}，模型: ${debugMode.model}`,
  })

  // Build system prompt with rules (same as Ollama version for fair comparison)
  const fullSystemPrompt = `${systemPrompt}

## 你的能力
你是一个 ReAct 智能体，遵循"思考-行动-观察"循环来解决问题。
你可以调用工具来执行实际操作，不要只靠想象给出答案。

## 可用工具

### todos - 任务规划工具
用于规划和追踪复杂任务的执行步骤。
- **推荐**: 一次性创建任务列表: {"action": "init", "tasks": ["任务1", "任务2", "任务3"]}
- 添加单个任务: {"action": "add", "content": "任务描述"}
- 完成任务: {"action": "complete", "content": "任务关键词"}
- 查看列表: {"action": "list"}
- 清空列表: {"action": "clear"}

### executeCommand - 执行命令
执行 Shell 命令（如 python、node、curl 等）。
输入: {"command": "python script.py"}

### readFile - 读取文件
读取工作区中的文件内容。
输入: {"filePath": "data/input.txt"}

### writeFile - 写入文件
将内容写入工作区文件（代码、数据、结果等）。
输入: {"filename": "output.py", "content": "print('hello')"}

### httpRequest - HTTP请求
发送 HTTP 请求获取网页或 API 数据。
输入: {"url": "https://api.example.com"}

### 浏览器自动化工具
用于控制浏览器执行网页操作。

#### browser_navigate - 导航到网页
打开指定URL的网页。
输入: {"url": "https://example.com"}

#### browser_click - 点击元素
点击页面上的元素（按钮、链接等）。
输入: {"selector": "button.submit"} 或 {"selector": "#login-btn"}
CSS选择器示例: "button.primary", "a[href*=login]", ".submit-btn"

#### browser_type - 输入文本
在输入框中输入文本。
输入: {"selector": "input[name=q]", "text": "搜索内容", "clear": true}
- clear: 可选，是否先清空输入框

#### browser_scroll - 滚动页面
向上或向下滚动页面。
输入: {"direction": "down", "amount": 500}
- direction: "up" 或 "down"
- amount: 可选，滚动像素数，默认300

#### browser_screenshot - 截图
截取当前页面的截图。
输入: {"fullPage": true} 或 {"selector": ".main-content"}

#### browser_getContent - 获取页面内容
获取页面的文本或HTML内容。
输入: {"format": "text"} 或 {"format": "html", "selector": ".article", "maxLength": 5000}
- format: "text" 或 "html"
- selector: 可选，获取特定元素
- maxLength: 可选，限制内容长度

#### browser_evaluate - 执行JavaScript
在页面中执行JavaScript代码。
输入: {"script": "document.title"}
可以执行更复杂的脚本获取页面数据。

#### browser_wait - 等待元素
等待指定元素出现在页面上。
输入: {"selector": ".result", "timeout": 5000}

## 工作流程（ReAct循环）

1. **思考** (Think): 分析任务，决定下一步行动
2. **行动** (Act): 调用合适的工具执行操作
3. **观察** (Observe): 查看工具返回的结果
4. **重复**: 直到任务完成

## 任务执行指南

### 何时使用 todos 规划？
- 任务需要3个以上步骤
- 任务包含多个子任务
- 需要按顺序完成多个操作
- 示例：搜索新闻 → 阅读内容 → 提取要点 → 写总结

### 如何使用 todos.init 一次性规划？
**推荐做法**: 使用 init 一次性创建所有任务
行动: {"action": "init", "tasks": ["步骤1描述", "步骤2描述", "步骤3描述", ...]}

**不推荐**: 多次调用 add 添加任务（浪费迭代次数）
行动: {"action": "add", "content": "步骤1"}  ← 不要这样做

### 如何正确执行任务？

**错误示范**: 直接给出答案，不调用任何工具
你: 我无法完成这个任务...（错误！应该先尝试使用可用工具）

**正确做法**: 使用工具逐步执行
思考: 这是一个需要实际操作的任务，我应该先规划步骤，然后调用工具执行
行动: 先用 todos.init 创建任务列表，再逐步调用合适的工具完成每一步

## 🚨 核心执行流程（必须严格遵守）

### 标准执行流程
1. **规划阶段**: 用 todos.init 一次性创建所有任务
2. **执行阶段**: 按顺序执行每个任务
   - 调用工具完成当前任务（如 httpRequest、executeCommand、writeFile 等）
   - **立即调用 todos.complete 标记任务完成**
   - 再执行下一个任务
3. **完成阶段**: 所有任务完成后给出最终答案

### ⚠️ 必须遵守的规则
1. **每完成一个任务，必须立即调用 todos.complete**
   - 执行完工具后，观察结果如果成功，立即: {"action": "complete", "content": "任务关键词"}
   - 然后再继续下一个任务
2. **按顺序执行任务**，不要跳过或乱序
3. **每个任务只能标记完成一次**

### 示例执行流程
---示例开始---
任务列表: ["获取热搜数据", "解析内容", "生成文章"]

迭代1: todos.init → 创建3个任务
迭代2: httpRequest 获取数据 → 观察成功 → todos.complete "获取热搜数据"
迭代3: 解析内容（或调用工具）→ 观察成功 → todos.complete "解析内容"
迭代4: writeFile 生成文章 → 观察成功 → todos.complete "生成文章"
迭代5: 所有任务完成 → 给出最终答案（不再调用工具）
---示例结束---

## 重要规则

1. **多步任务先用 todos 规划** - 添加任务列表后再逐步执行
2. **必须调用工具执行实际操作** - 不要空想，要行动
3. **完成一步立即标记** - 每完成一个任务必须调用 todos.complete
4. **按顺序执行** - 按任务列表顺序逐个完成
5. **写入脚本后立即执行** - 用 writeFile 写代码后，用 executeCommand 运行
6. **每次只调用一个工具** - 等待观察结果后再决定下一步
7. **所有任务完成后给出最终答案** - 不再调用工具，直接回答

## 💬 用户交互（可选）

${data.enableUserInput ? `
当你在执行任务过程中需要用户确认、提供更多信息或做出选择时，可以使用用户交互功能。

**何时使用**：
- 需要用户确认是否继续执行某个操作
- 需要用户提供额外的信息（如 API Key、配置参数等）
- 遇到多个可行方案，需要用户选择
- 任务执行前需要用户确认计划

**如何使用**：
在你的思考或回答中，使用以下格式：
\`\`\`
WAIT_FOR_INPUT: 你的问题
\`\`\`

**示例**：
\`\`\`
思考: 我需要访问某个 API，但需要用户提供 API Key。

WAIT_FOR_INPUT: 我需要访问天气 API，请提供您的 API Key
\`\`\`

或者：
\`\`\`
思考: 我找到了两种方案来完成任务，需要用户选择。

WAIT_FOR_INPUT: 我找到了两种方案：
1. 使用 Python 脚本处理（速度快，但需要安装依赖）
2. 使用在线 API 处理（无需安装，但速度较慢）
请选择方案（输入 1 或 2）
\`\`\`

**注意事项**：
- 等待用户输入后，你会收到用户的回复，然后继续执行
- 不要过度使用，仅在确实需要用户参与时使用
- 提问要清晰明确，避免模糊不清
- 用户输入后，你可以基于用户的回复继续执行任务
` : '（用户交互功能未启用）'}

## JSON格式提醒
- 代码中的反斜杠必须双写转义（\\\\cos -> \\\\\\\\cos，\\\\n -> \\\\\\\\n）
- 确保所有字符串正确转义`

  // Initialize messages using OpenAI format
  const messages: OpenAIMessage[] = [
    { role: 'system', content: fullSystemPrompt },
    { role: 'user', content: userMessage }
  ]

  while (iteration < maxIterations && !finalAnswer) {
    // Check if execution was cancelled
    if (context.signal?.aborted) {
      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: 'ReAct Agent 执行已取消',
      })
      break
    }

    iteration++

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
    executionStore.updateReActStep(context.executionId, node.id, newStep)

    try {
      const response = await client.chat({
        model: debugMode.model,
        messages,
        temperature: data.temperature,
        max_tokens: data.maxTokens,
        tools: openaiTools,
      })

      const content = response.content || ''
      // DeepSeek reasoner requires reasoning_content to be preserved in message history
      const assistantMessage: OpenAIMessage = { role: 'assistant', content, tool_calls: response.tool_calls }
      if (response.reasoning_content) {
        assistantMessage.reasoning_content = response.reasoning_content
      }
      messages.push(assistantMessage)

      // Update step with thought
      const thought = content || '(思考中...)'
      executionStore.updateReActStep(context.executionId, node.id, {
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

      // Check if no tool calls - means final answer or waiting for user input
      if (!response.tool_calls || response.tool_calls.length === 0) {
        // Check if the response contains WAIT_FOR_INPUT marker
        if (data.enableUserInput && content.includes('WAIT_FOR_INPUT:')) {
          const promptMatch = content.match(/WAIT_FOR_INPUT:\s*(.+?)(?:\n|$)/s)
          const promptText = promptMatch ? promptMatch[1].trim() : '请提供更多信息'
          
          const contextText = content.replace(/WAIT_FOR_INPUT:.*$/s, '').trim()
          
          executionStore.setReActWaitingForInput(context.executionId, node.id, promptText, contextText)
          
          executionStore.updateReActStep(context.executionId, node.id, {
            id: stepId,
            status: 'completed',
            thought: content,
            thoughtStreaming: false,
          })
          executionStore.completeReActStep(context.executionId, node.id, stepId)
          
          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: `等待用户输入: ${promptText}`,
          })
          
          if (data.stream) {
            context.onStream?.(node.id, `\n⏸️ 等待用户输入: ${promptText}\n`)
          }
          
          return {
            status: 'waiting',
            prompt: promptText,
            context: contextText,
          }
        }
        
        finalAnswer = content || '任务完成'
        executionStore.updateReActStep(context.executionId, node.id, { id: stepId, status: 'completed' })
        executionStore.completeReActStep(context.executionId, node.id, stepId)
        executionStore.setReActFinalAnswer(context.executionId, node.id, finalAnswer)

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
      for (const toolCall of response.tool_calls) {
        const toolName = toolCall.function.name
        const toolArgs = parseToolCallArgs(toolCall.function.arguments)

        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `调用工具: ${toolName}`,
        })

        executionStore.updateReActStep(context.executionId, node.id, {
          id: stepId,
          status: 'acting',
          action: toolName,
          actionInput: JSON.stringify(toolArgs),
        })

        // Find and execute the tool
        const tool = allTools.find(t => t.name === toolName)

        if (!tool) {
          const errorObs = `错误: 未知工具 "${toolName}"`
          messages.push({ role: 'tool', content: errorObs, tool_call_id: toolCall.id })
          executionStore.updateReActStep(context.executionId, node.id, {
            id: stepId,
            status: 'error',
            observation: errorObs,
            observationError: true,
          })
          executionStore.completeReActStep(context.executionId, node.id, stepId)
          continue
        }

        // Execute the tool
        executionStore.updateReActStep(context.executionId, node.id, { id: stepId, status: 'observing' })

        if (data.stream) {
          context.onStream?.(node.id, `🔧 调用: ${toolName}\n`)
        }

        try {
          const result = await executeTool(tool, toolArgs, context, todosManager)

          // Sync todos state to store after each tool execution
          const todosStatus = todosManager.getStatus()
          executionStore.updateReActTodos(context.executionId, node.id, todosStatus.items)

          const observation = result.success ? result.output : `错误: ${result.error}`
          messages.push({ role: 'tool', content: observation, tool_call_id: toolCall.id })

          executionStore.updateReActStep(context.executionId, node.id, {
            id: stepId,
            observation,
            observationError: !result.success,
          })
          executionStore.completeReActStep(context.executionId, node.id, stepId)

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: result.success ? 'info' : 'error',
            message: `观察: ${observation.slice(0, 200)}${observation.length > 200 ? '...' : ''}`,
          })

          if (data.stream) {
            const truncatedObs = observation.length > 500 ? observation.slice(0, 500) + '...' : observation
            context.onStream?.(node.id, `👁 观察: ${truncatedObs}\n`)
          }
        } catch (error) {
          const errorObs = `工具执行错误: ${(error as Error).message}`
          messages.push({ role: 'tool', content: errorObs, tool_call_id: toolCall.id })
          executionStore.updateReActStep(context.executionId, node.id, {
            id: stepId,
            status: 'error',
            observation: errorObs,
            observationError: true,
          })
          executionStore.completeReActStep(context.executionId, node.id, stepId)

          if (data.stream) {
            context.onStream?.(node.id, `❌ ${errorObs}\n`)
          }
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

  if (!finalAnswer) {
    finalAnswer = `在 ${maxIterations} 次迭代后未能得出最终答案。`
    executionStore.setReActFinalAnswer(context.executionId, node.id, finalAnswer)
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
    message: `ReAct 智能体执行完成 (OpenAI)，迭代次数: ${iteration}`,
  })

  return {
    response: finalAnswer,
    provider: 'openai',
  }
}

/**
 * Continue ReAct Agent execution with user input
 */
export async function continueReactAgentWithUserInput(
  nodeId: string,
  userInput: string,
  nodeData: ReactAgentNodeData,
  context: ExecutionContext
): Promise<unknown> {
  const executionStore = useExecutionStore.getState()
  const reactState = executionStore.getReActState(context.executionId, nodeId)
  
  if (!reactState) {
    throw new Error('ReAct Agent state not found')
  }
  
  const debugMode = nodeData.debugMode
  
  context.onLog?.({
    nodeId,
    nodeName: nodeData.label,
    level: 'info',
    message: `用户输入: ${userInput.slice(0, 100)}...`,
  })
  
  if (debugMode?.enabled) {
    return continueReActWithOpenAI(nodeId, userInput, nodeData, context)
  } else {
    return continueReActWithOllama(nodeId, userInput, nodeData, context)
  }
}

async function continueReActWithOllama(
  nodeId: string,
  userInput: string,
  nodeData: ReactAgentNodeData,
  context: ExecutionContext
): Promise<unknown> {
  const executionStore = useExecutionStore.getState()
  const ollama = new Ollama({ host: context.ollamaHost })
  
  const vars = { ...context.variables }
  const systemPrompt = interpolateVariables(nodeData.systemPrompt, vars)
  const userMessage = interpolateVariables(nodeData.userMessage, vars)
  
  const allTools = getEnabledTools(nodeData.enabledTools || [])
  const ollamaTools = convertToOllamaTools(allTools)
  const todosManager = new TodosManager()
  
  const maxIterations = nodeData.maxIterations || 10
  const reactState = executionStore.getReActState(context.executionId, nodeId)!
  
  let iteration = reactState.currentIteration
  let finalAnswer: string | null = null
  
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
    { role: 'user', content: userInput }
  ]
  
  while (iteration < maxIterations && !finalAnswer) {
    if (context.signal?.aborted) {
      break
    }
    
    iteration++
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
    executionStore.updateReActStep(context.executionId, nodeId, newStep)
    
    const response = await ollama.chat({
      model: nodeData.model,
      messages,
      tools: ollamaTools,
      options: {
        temperature: nodeData.temperature,
        num_predict: nodeData.maxTokens,
      },
      stream: false,
    })
    
    const content = response.message.content || ''
    messages.push(response.message)
    
    const thought = content || '(思考中...)'
    executionStore.updateReActStep(context.executionId, nodeId, {
      id: stepId,
      thought,
      thoughtStreaming: false,
    })
    
    if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
      if (nodeData.enableUserInput && content.includes('WAIT_FOR_INPUT:')) {
        const promptMatch = content.match(/WAIT_FOR_INPUT:\s*(.+?)(?:\n|$)/s)
        const promptText = promptMatch ? promptMatch[1].trim() : '请提供更多信息'
        const contextText = content.replace(/WAIT_FOR_INPUT:.*$/s, '').trim()
        
        executionStore.setReActWaitingForInput(context.executionId, nodeId, promptText, contextText)
        executionStore.updateReActStep(context.executionId, nodeId, {
          id: stepId,
          status: 'completed',
          thought: content,
          thoughtStreaming: false,
        })
        executionStore.completeReActStep(context.executionId, nodeId, stepId)
        
        return {
          status: 'waiting',
          prompt: promptText,
          context: contextText,
        }
      }
      
      finalAnswer = content || '任务完成'
      executionStore.setReActFinalAnswer(context.executionId, nodeId, finalAnswer)
      break
    }
    
    for (const toolCall of response.message.tool_calls) {
      const toolName = toolCall.function.name
      const toolArgs = toolCall.function.arguments
      const tool = allTools.find(t => t.name === toolName)
      
      if (!tool) continue
      
      executionStore.updateReActStep(context.executionId, nodeId, {
        id: stepId,
        status: 'acting',
        action: toolName,
        actionInput: JSON.stringify(toolArgs),
      })
      
      const result = await executeTool(tool, toolArgs, context, todosManager)
      const observation = result.success ? result.output : `错误: ${result.error}`
      
      messages.push({ role: 'tool', content: observation })
      
      executionStore.updateReActStep(context.executionId, nodeId, {
        id: stepId,
        status: 'observing',
        observation,
        observationError: !result.success,
      })
      executionStore.completeReActStep(context.executionId, nodeId, stepId)
    }
  }
  
  if (!finalAnswer) {
    finalAnswer = `在 ${maxIterations} 次迭代后未能得出最终答案。`
  }
  
  return {
    response: finalAnswer,
  }
}

async function continueReActWithOpenAI(
  nodeId: string,
  userInput: string,
  nodeData: ReactAgentNodeData,
  context: ExecutionContext
): Promise<unknown> {
  const executionStore = useExecutionStore.getState()
  const debugMode = nodeData.debugMode!
  
  let apiKey = debugMode.apiKey
  if (!apiKey) {
    const storedKey = await window.electronAPI.openai.getApiKey(`react-${nodeId}`)
    if (storedKey) {
      apiKey = storedKey
    } else {
      const workspaceKey = await window.electronAPI.openai.getApiKey('workspace-default')
      if (workspaceKey) {
        apiKey = workspaceKey
      }
    }
  }
  
  if (!apiKey) {
    throw new Error('OpenAI API Key 未配置')
  }
  
  const client = new OpenAIClient(apiKey, debugMode.apiEndpoint)
  
  const vars = { ...context.variables }
  const systemPrompt = interpolateVariables(nodeData.systemPrompt, vars)
  const userMessage = interpolateVariables(nodeData.userMessage, vars)
  
  const allTools = getEnabledTools(nodeData.enabledTools || [])
  const openaiTools = allTools.map(tool => {
    const params = getToolParameters(tool.type)
    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: params.type,
          properties: params.properties as Record<string, unknown>,
          required: params.required
        }
      }
    }
  })
  
  const todosManager = new TodosManager()
  const maxIterations = nodeData.maxIterations || 10
  const reactState = executionStore.getReActState(context.executionId, nodeId)!
  
  let iteration = reactState.currentIteration
  let finalAnswer: string | null = null
  
  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
    { role: 'user', content: userInput }
  ]
  
  while (iteration < maxIterations && !finalAnswer) {
    if (context.signal?.aborted) {
      break
    }
    
    iteration++
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
    executionStore.updateReActStep(context.executionId, nodeId, newStep)
    
    const response = await client.chat({
      model: debugMode.model,
      messages,
      temperature: nodeData.temperature,
      max_tokens: nodeData.maxTokens,
      tools: openaiTools,
    })
    
    const content = response.content || ''
    const assistantMessage: OpenAIMessage = { role: 'assistant', content, tool_calls: response.tool_calls }
    if (response.reasoning_content) {
      assistantMessage.reasoning_content = response.reasoning_content
    }
    messages.push(assistantMessage)
    
    const thought = content || '(思考中...)'
    executionStore.updateReActStep(context.executionId, nodeId, {
      id: stepId,
      thought,
      thoughtStreaming: false,
    })
    
    if (!response.tool_calls || response.tool_calls.length === 0) {
      if (nodeData.enableUserInput && content.includes('WAIT_FOR_INPUT:')) {
        const promptMatch = content.match(/WAIT_FOR_INPUT:\s*(.+?)(?:\n|$)/s)
        const promptText = promptMatch ? promptMatch[1].trim() : '请提供更多信息'
        const contextText = content.replace(/WAIT_FOR_INPUT:.*$/s, '').trim()
        
        executionStore.setReActWaitingForInput(context.executionId, nodeId, promptText, contextText)
        executionStore.updateReActStep(context.executionId, nodeId, {
          id: stepId,
          status: 'completed',
          thought: content,
          thoughtStreaming: false,
        })
        executionStore.completeReActStep(context.executionId, nodeId, stepId)
        
        return {
          status: 'waiting',
          prompt: promptText,
          context: contextText,
        }
      }
      
      finalAnswer = content || '任务完成'
      executionStore.setReActFinalAnswer(context.executionId, nodeId, finalAnswer)
      break
    }
    
    for (const toolCall of response.tool_calls) {
      const toolName = toolCall.function.name
      const toolArgs = parseToolCallArgs(toolCall.function.arguments)
      const tool = allTools.find(t => t.name === toolName)
      
      if (!tool) continue
      
      executionStore.updateReActStep(context.executionId, nodeId, {
        id: stepId,
        status: 'acting',
        action: toolName,
        actionInput: JSON.stringify(toolArgs),
      })
      
      const result = await executeTool(tool, toolArgs, context, todosManager)
      const observation = result.success ? result.output : `错误: ${result.error}`
      
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: observation })
      
      executionStore.updateReActStep(context.executionId, nodeId, {
        id: stepId,
        status: 'observing',
        observation,
        observationError: !result.success,
      })
      executionStore.completeReActStep(context.executionId, nodeId, stepId)
    }
  }
  
  if (!finalAnswer) {
    finalAnswer = `在 ${maxIterations} 次迭代后未能得出最终答案。`
  }
  
  return {
    response: finalAnswer,
    provider: 'openai',
  }
}
