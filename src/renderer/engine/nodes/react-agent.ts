import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, ReactAgentNodeData, ReActStep } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import type { GeneratedFileInfo } from '@/store/agent-store'
import { interpolateVariables } from '../executor'
import { executeTool, TodosManager, getEnabledTools } from '../tools'
import { useExecutionStore } from '@/store/execution-store'
import { OpenAIClient, OpenAIMessage, OpenAIChatResponse, parseToolCallArgs } from '../openai-client'
import {
  compressOpenAIContext,
  estimateMessageTokens,
  getContextConfig
} from '../react-agent/context-compressor'
import { resolveAIConfig } from '../config-resolver'

// Tool parameter property type
interface ToolParamProperty {
  type?: string | string[]
  description?: string
  enum?: string[]
  items?: ToolParamProperty
  properties?: Record<string, ToolParamProperty>
  required?: string[]
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
            description: '必填。操作类型: init(初始化任务列表), add(添加任务), complete(完成任务), list(列出任务), remove(删除任务), clear(清空)'
          },
          tasks: {
            type: 'array',
            items: { type: 'string' },
            description: '任务列表（仅用于init操作）。例如: ["读取文件", "分析内容", "生成总结"]'
          },
          content: {
            type: 'string',
            description: '任务内容关键词（用于add/complete/remove操作）'
          },
          taskId: {
            type: 'string',
            description: '任务ID（可选，用于精确匹配）'
          }
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
    case 'writeMultipleFiles':
      return {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            description: '文件列表',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string', description: '文件路径' },
                content: { type: 'string', description: '文件内容' }
              },
              required: ['filename', 'content']
            }
          }
        },
        required: ['files']
      }
    case 'executePython':
      return {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Python 代码' },
          saveAs: { type: 'string', description: '可选：保存为文件名（如 script.py）' }
        },
        required: ['code']
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

// Detect if the agent is stuck in a loop
function detectLoop(
  messages: OpenAIMessage[]
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
          result: messages[i + 1].content || ''
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

  // Check if init was already called - no longer blocking, allow dynamic task addition
  // const hasInitCall = toolCallsHistory.some(
  //   (h) => h.name === 'todos' && h.result.includes('已创建')
  // )

  if (todosAddCount > 4) {
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

  if (writeFileCount >= 4) {
    return {
      isLoop: true,
      loopType: 'repeatedWriteFile',
      suggestion: `你已经写入了 ${writeFileCount} 次文件。现在必须执行脚本或给出最终答案！`,
      blockedActions: ['writefile']
    }
  }

  // Check for repeated identical actions
  if (toolCallsHistory.length >= 5) {
    const recentActions = toolCallsHistory.slice(-5).map((h) => h.name)
    const firstAction = recentActions[0]
    const allSame = recentActions.every((a) => a === firstAction)

    if (allSame && firstAction) {
      return {
        isLoop: true,
        loopType: 'repeatedAction',
        suggestion: `你已经连续5次执行相同的操作。请使用不同的工具或给出最终答案。`,
        blockedActions: [firstAction]
      }
    }
  }

  return { isLoop: false, loopType: null, suggestion: null, blockedActions: [] }
}

/**
 * Analyze dependencies between tool calls to determine which can be executed in parallel
 * Returns groups of tool calls that can be executed together
 */
interface ToolCallWithIndex {
  toolCall: { id: string; function: { name: string; arguments: string } }
  index: number
}

function analyzeToolDependencies(
  toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>
): ToolCallWithIndex[][] {
  if (toolCalls.length <= 1) {
    return toolCalls.map((tc, i) => ({ toolCall: tc, index: i })).map(t => [t])
  }

  // Parse tool arguments to extract file references
  const getFileReferences = (toolName: string, args: Record<string, unknown>): string[] => {
    const refs: string[] = []
    const lowerName = toolName.toLowerCase()

    if (lowerName === 'writefile' || lowerName === 'readfile') {
      if (args.filename) refs.push(String(args.filename).toLowerCase())
      if (args.filePath) refs.push(String(args.filePath).toLowerCase())
    } else if (lowerName === 'executecommand') {
      // Extract potential file references from command
      const command = String(args.command || '')
      // Match common patterns like "python script.py" or "node app.js"
      const fileMatches = command.match(/\b(\w+\.(py|js|ts|sh|json|txt))\b/gi)
      if (fileMatches) refs.push(...fileMatches.map(f => f.toLowerCase()))
    }

    return refs
  }

  // Build dependency graph
  const toolCallInfos = toolCalls.map((tc, i) => {
    const args = parseToolCallArgs(tc.function.arguments)
    return {
      toolCall: tc,
      index: i,
      name: tc.function.name.toLowerCase(),
      args,
      fileRefs: getFileReferences(tc.function.name, args),
      dependsOn: new Set<number>(),
    }
  })

  // Analyze dependencies
  for (let i = 0; i < toolCallInfos.length; i++) {
    for (let j = 0; j < i; j++) {
      const current = toolCallInfos[i]
      const previous = toolCallInfos[j]

      // Rule 1: readFile always depends on previous operations (result might be used)
      if (current.name === 'readfile') {
        current.dependsOn.add(j)
        continue
      }

      // Rule 2: executeCommand after writeFile on same file -> dependency
      if (current.name === 'executecommand' && previous.name === 'writefile') {
        const execFiles = current.fileRefs
        const writeFile = previous.args.filename || previous.args.filePath
        if (writeFile && execFiles.some(f => f.includes(String(writeFile).toLowerCase()))) {
          current.dependsOn.add(j)
        }
      }

      // Rule 3: writeFile to same file -> dependency (overwrite)
      if (current.name === 'writefile' && previous.name === 'writefile') {
        const currentFile = String(current.args.filename || current.args.filePath).toLowerCase()
        const previousFile = String(previous.args.filename || previous.args.filePath).toLowerCase()
        if (currentFile === previousFile) {
          current.dependsOn.add(j)
        }
      }

      // Rule 4: todos operations should be sequential
      if (current.name === 'todos' && previous.name === 'todos') {
        current.dependsOn.add(j)
      }
    }
  }

  // Group tool calls by dependency levels (topological sort)
  const groups: ToolCallWithIndex[][] = []
  const assigned = new Set<number>()

  while (assigned.size < toolCallInfos.length) {
    const group: ToolCallWithIndex[] = []

    for (const info of toolCallInfos) {
      if (assigned.has(info.index)) continue

      // Check if all dependencies are satisfied
      const depsSatisfied = Array.from(info.dependsOn).every(dep => assigned.has(dep))
      if (depsSatisfied) {
        group.push({ toolCall: info.toolCall, index: info.index })
      }
    }

    if (group.length === 0) {
      // Circular dependency or bug, just add remaining items sequentially
      for (const info of toolCallInfos) {
        if (!assigned.has(info.index)) {
          group.push({ toolCall: info.toolCall, index: info.index })
          break
        }
      }
    }

    for (const item of group) {
      assigned.add(item.index)
    }
    groups.push(group)
  }

  return groups
}

// Build full system prompt
function buildFullSystemPrompt(systemPrompt: string, enableUserInput: boolean): string {
  return `${systemPrompt}

## 你的能力
你是一个高效的 ReAct 智能体，遵循"思考-行动-观察"循环来解决问题。
你可以调用工具来执行实际操作，不要只靠想象给出答案。

## ⚡ 核心效率原则（最重要）

1. **规划先行**: 接到任务后，建议先用 todos 工具规划步骤（使用 init 一次性创建）
2. **适时早停**: 确信任务完成时立即给出最终答案，不要反复验证
3. **一次性完成**: 写代码时要完整，避免多次修改；执行成功后直接回答

## 可用工具

### todos - 任务规划工具（推荐首先使用）
**重要**: 调用此工具时必须提供 action 参数！

使用示例:
- 初始化任务列表: {"action": "init", "tasks": ["读取文件", "分析内容", "生成总结"]}
- 完成任务: {"action": "complete", "content": "读取"}
- 添加任务: {"action": "add", "content": "新任务"}

注意: action 是必填参数，可选值: init, add, complete, list, remove, clear

### executeCommand - 执行命令
执行 Shell 命令（python、node、curl 等）。
输入: {"command": "python script.py"}

### readFile - 读取文件
输入: {"filePath": "data/input.txt"}

### writeFile - 写入文件
输入: {"filename": "output.py", "content": "print('hello')"}

### writeMultipleFiles - 批量写入
一次写入多个文件: {"files": [{"filename": "a.py", "content": "..."}, {"filename": "b.py", "content": "..."}]}

### httpRequest - HTTP请求
输入: {"url": "https://api.example.com", "method": "GET"}

### 浏览器工具
- browser_navigate: {"url": "https://example.com"}
- browser_click: {"selector": "button.submit"}
- browser_type: {"selector": "input[name=q]", "text": "搜索内容"}
- browser_scroll: {"direction": "down", "amount": 500}
- browser_screenshot: {"fullPage": true}
- browser_getContent: {"format": "text"} 或 {"format": "html", "selector": ".article"}
- browser_evaluate: {"script": "document.title"}
- browser_wait: {"selector": ".result", "timeout": 5000}

## ⚡ 并行工具调用（提高效率）

**你可以在一次响应中返回多个 tool_calls 来并行执行独立的操作！**

✅ 应该并行（无依赖）:
- 读取多个不同文件
- 调用多个独立的工作流

❌ 必须串行（有依赖）:
- 先写文件再读取同一文件
- 先写脚本再执行该脚本
- 一个操作的输入依赖另一个的输出

## 工作流程

1. **思考**: 分析任务，决定下一步
2. **行动**: 调用工具（可并行调用多个独立工具）
3. **观察**: 查看结果
4. **完成**: 任务成功后立即给出最终答案

## 环境提示
- Python: Mac/Linux 用 python3，Windows 用 python
- 代码必须包含所有 import 语句

## 💬 用户交互

${enableUserInput ? `
需要用户输入时，在回答中使用：
\`\`\`
WAIT_FOR_INPUT: 你的问题
\`\`\`
` : '（用户交互功能未启用）'}

## JSON格式提醒
- 代码中的反斜杠必须双写转义（\\\\cos -> \\\\\\\\cos）`
}

/**
 * Generate a summary of completed tasks using LLM
 * This provides a meaningful conclusion instead of just "task completed"
 */
async function generateTaskSummary(
  client: OpenAIClient,
  model: string,
  messages: OpenAIMessage[],
  todosStatus: { total: number; completed: number; pending: number },
  steps: ReActStep[]
): Promise<string> {
  // Build key steps summary (last 5 steps with action and observation)
  const keyStepsSummary = steps
    .filter(s => s.action && s.observation)
    .slice(-5)
    .map(s => `- 操作: ${s.action}\n  结果: ${(s.observation || '').slice(0, 200)}`)
    .join('\n')

  const summaryMessages: OpenAIMessage[] = [
    messages[0], // System prompt
    messages[1], // Original user message
    {
      role: 'user',
      content: `任务已全部完成。请根据以上执行过程，用简洁的中文回答用户的原始问题。

执行记录摘要:
${keyStepsSummary || '（无执行记录）'}

请直接回答用户的问题，总结你的发现和结论。`
    }
  ]

  try {
    const response = await client.chat({
      model,
      messages: summaryMessages,
      temperature: 0.3,
      max_tokens: 1000,
    })
    return response.content || `任务已完成 ${todosStatus.completed} 个步骤。`
  } catch (error) {
    console.error('[ReAct] Failed to generate summary:', error)
    return `任务已完成 ${todosStatus.completed} 个步骤。`
  }
}

export function createReactAgentExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as ReactAgentNodeData
      return executeReAct(node, data, input, context)
    },
  }
}

/**
 * Execute ReAct with OpenAI API
 */
async function executeReAct(
  node: Node<WorkflowNodeData>,
  data: ReactAgentNodeData,
  input: Record<string, unknown>,
  context: ExecutionContext
): Promise<unknown> {
  const vars = { ...context.variables, ...input }

  // Interpolate variables in prompts
  const systemPrompt = interpolateVariables(data.systemPrompt, vars)
  const userMessage = interpolateVariables(data.userMessage, vars)

  // Get API configuration from global config
  const aiConfig = await resolveAIConfig()
  const apiKey = aiConfig.apiKey || 'ollama' // Ollama doesn't require API key, use placeholder
  const apiEndpoint = aiConfig.apiEndpoint

  const client = new OpenAIClient(apiKey, apiEndpoint)

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
  const generatedFiles: GeneratedFileInfo[] = [] // Track generated files

  // Initialize ReAct state in execution store
  const executionStore = useExecutionStore.getState()
  executionStore.initReActState(context.executionId, node.id, maxIterations)

  context.onLog?.({
    nodeId: node.id,
    nodeName: data.label,
    level: 'info',
    message: `开始 ReAct 智能体执行，最大迭代: ${maxIterations}，模型: ${data.model}`,
  })

  // Build system prompt with rules
  const fullSystemPrompt = buildFullSystemPrompt(systemPrompt, data.enableUserInput || false)

  // Initialize messages using OpenAI format
  const messages: OpenAIMessage[] = [
    { role: 'system', content: fullSystemPrompt },
    { role: 'user', content: userMessage }
  ]

  // Get context configuration for the model
  const contextConfig = getContextConfig(data.model)
  const maxContextTokens = contextConfig.maxContextTokens - contextConfig.reserveTokens

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

    // Auto-compress context if approaching token limit
    const currentTokens = estimateMessageTokens(messages)
    if (currentTokens > maxContextTokens * 0.8) {
      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'warn',
        message: `上下文接近限制 (${Math.round(currentTokens / 1000)}k tokens)，正在自动压缩...`,
      })

      const compressionResult = compressOpenAIContext(messages, maxContextTokens, {
        keepRecentIterations: contextConfig.keepRecentIterations,
        maxObservationLength: contextConfig.maxObservationLength,
        enableSummarization: contextConfig.enableSummarization,
      })

      // Replace messages with compressed version
      messages.length = 0
      messages.push(...compressionResult.messages)

      if (compressionResult.compressed) {
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `上下文已压缩: ${Math.round(compressionResult.originalTokens / 1000)}k -> ${Math.round(compressionResult.newTokens / 1000)}k tokens (${Math.round(compressionResult.compressionRatio * 100)}%)`,
        })

        if (data.stream && compressionResult.summary) {
          context.onStream?.(node.id, `\n📦 ${compressionResult.summary}\n`)
        }
      }
    }

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

    try {
      // Use streaming if enabled, otherwise fall back to non-streaming
      let response: OpenAIChatResponse
      let streamingThought = '' // Accumulate streaming content
      let streamingReasoning = '' // Accumulate reasoning content (DeepSeek R1, etc.)
      let pendingToolNames: string[] = [] // Track tool names as they come in

      if (data.stream) {
        // Streaming call with real-time content display
        response = await client.chatStreamWithTools(
          {
            model: data.model,
            messages,
            temperature: data.temperature,
            max_tokens: data.maxTokens,
            tools: openaiTools,
          },
          // Content chunk callback
          (chunk) => {
            // Real-time streaming callback
            context.onStream?.(node.id, chunk)
            // Accumulate content
            streamingThought += chunk
            // Update step thought - prefer reasoning content if available
            const displayThought = streamingReasoning || streamingThought
            if (displayThought) {
              executionStore.updateReActStep(context.executionId, node.id, {
                id: stepId,
                thought: displayThought,
              })
            }
          },
          // Tool call name callback - called when tool name is first received
          (toolName) => {
            if (!pendingToolNames.includes(toolName)) {
              pendingToolNames.push(toolName)
              // Update UI to show which tools are being called
              const toolMessage = `正在调用: ${toolName}`
              executionStore.updateReActStep(context.executionId, node.id, {
                id: stepId,
                thought: streamingReasoning || streamingThought || toolMessage,
              })
              context.onStream?.(node.id, `🔧 ${toolMessage}\n`)
            }
          },
          // Reasoning chunk callback - for DeepSeek R1 and other reasoning models
          (chunk) => {
            streamingReasoning += chunk
            // Store reasoning content for UI display
            executionStore.appendReasoningStreamOutput(context.executionId, node.id, chunk)
            // Update step thought with reasoning content
            executionStore.updateReActStep(context.executionId, node.id, {
              id: stepId,
              thought: streamingReasoning,
            })
          }
        )
      } else {
        // Non-streaming call
        response = await client.chat({
          model: data.model,
          messages,
          temperature: data.temperature,
          max_tokens: data.maxTokens,
          tools: openaiTools,
        })
      }

      const content = response.content || ''
      const reasoningContent = response.reasoning_content || streamingReasoning || ''
      // DeepSeek reasoner requires reasoning_content to be preserved in message history
      const assistantMessage: OpenAIMessage = { role: 'assistant', content, tool_calls: response.tool_calls }
      if (reasoningContent) {
        assistantMessage.reasoning_content = reasoningContent
      }
      messages.push(assistantMessage)

      // Debug: Log response details
      console.log('[ReAct] Response received:', {
        contentLength: content.length,
        contentPreview: content.slice(0, 100),
        tool_calls: response.tool_calls?.map(tc => ({ id: tc.id, name: tc.function.name })),
        finish_reason: response.finish_reason
      })

      // Update step with thought - include reasoning content if available (DeepSeek R1, etc.)
      // For reasoning models, prefer reasoning_content as it contains the actual thought process
      const thought = reasoningContent || content || '(思考中...)'
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
        console.log('[ReAct] No tool calls detected, treating as final answer')
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

        // If response is too brief and we have completed tasks, generate a better summary
        if (finalAnswer.length < 100 && todosManager.getStatus().completed > 0) {
          const reactState = executionStore.getReActState(context.executionId, node.id)
          finalAnswer = await generateTaskSummary(
            client,
            data.model,
            messages,
            todosManager.getStatus(),
            reactState?.steps || []
          )
        }

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

      // Process tool calls with parallel execution support
      const toolCallGroups = analyzeToolDependencies(response.tool_calls)
      const isParallelExecution = toolCallGroups.length > 0 && toolCallGroups[0].length > 1

      if (isParallelExecution) {
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `并行执行 ${response.tool_calls.length} 个工具调用`,
        })
      }

      // Immediately update step status to 'acting' before executing tools
      // This ensures the UI shows the acting state in real-time
      executionStore.updateReActStep(context.executionId, node.id, {
        id: stepId,
        status: 'acting',
        action: response.tool_calls.map(tc => tc.function.name).join(', '),
        actionInput: JSON.stringify(response.tool_calls.map(tc => parseToolCallArgs(tc.function.arguments))),
      })

      // Yield to allow React to render the updated state before blocking on tool execution
      await new Promise(resolve => setTimeout(resolve, 0))

      for (const group of toolCallGroups) {
        // Track observations as tools complete (for real-time UI updates)
        const groupObservations: string[] = []
        const allResults: Array<{
          toolCallId: string
          toolName: string
          success: boolean
          observation: string
        }> = []

        // Execute tools in the same group and update UI as each completes
        await Promise.all(group.map(async ({ toolCall }) => {
          const toolName = toolCall.function.name
          const rawArgs = toolCall.function.arguments || ''
          let toolArgs = parseToolCallArgs(rawArgs)

          // Handle empty or invalid arguments - some LLMs (like DeepSeek) may not send args properly
          // Return a helpful error message so the LLM can correct itself
          if (Object.keys(toolArgs).length === 0) {
            console.log('[ReAct] Empty/invalid args for tool:', toolName, 'raw:', rawArgs)
            // For tools that require parameters, provide a helpful error
            if (toolName === 'todos') {
              const errorResult = {
                toolCallId: toolCall.id,
                toolName,
                success: false,
                observation: `错误: 调用 todos 工具时未提供参数。必须提供 action 参数。例如: {"action": "init", "tasks": ["任务1", "任务2"]}`,
              }
              allResults.push(errorResult)
              groupObservations.push(errorResult.observation)

              executionStore.updateReActStep(context.executionId, node.id, {
                id: stepId,
                status: 'observing',
                observation: errorResult.observation,
                observationError: true,
              })
              return
            } else if (toolName === 'readFile') {
              const errorResult = {
                toolCallId: toolCall.id,
                toolName,
                success: false,
                observation: `错误: 调用 readFile 工具时未提供参数。必须提供 filePath 参数。例如: {"filePath": "README.md"}`,
              }
              allResults.push(errorResult)
              groupObservations.push(errorResult.observation)
              return
            } else if (toolName === 'executeCommand') {
              const errorResult = {
                toolCallId: toolCall.id,
                toolName,
                success: false,
                observation: `错误: 调用 executeCommand 工具时未提供参数。必须提供 command 参数。例如: {"command": "ls -la"}`,
              }
              allResults.push(errorResult)
              groupObservations.push(errorResult.observation)
              return
            }
          }

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: `调用工具: ${toolName}`,
          })

          // Find and execute the tool
          const tool = allTools.find(t => t.name === toolName)

          let result: { toolCallId: string; toolName: string; success: boolean; observation: string }

          if (!tool) {
            result = {
              toolCallId: toolCall.id,
              toolName,
              success: false,
              observation: `错误: 未知工具 "${toolName}"`,
            }
          } else if (loopInfo.blockedActions.includes(toolName.toLowerCase())) {
            const blockedObservation = `🚫 操作被阻止: ${loopInfo.suggestion || '此操作已被阻止'}`
            result = {
              toolCallId: toolCall.id,
              toolName,
              success: false,
              observation: blockedObservation,
            }
          } else {
            if (data.stream) {
              context.onStream?.(node.id, `🔧 调用: ${toolName}\n`)
            }

            try {
              const toolResult = await executeTool(tool, toolArgs, context, todosManager)
              let observation = toolResult.success ? toolResult.output : `错误: ${toolResult.error}`

              if (tool.name.toLowerCase() === 'writefile' && toolResult.success) {
                const fileMatch = observation.match(/文件已写入:?\s*([^\n💡]+)/iu)
                const filePath = fileMatch ? fileMatch[1].trim() : ''
                const ext = filePath.split('.').pop()?.toLowerCase()
                const scriptExts = ['py', 'js', 'ts', 'sh', 'bat', 'ps1', 'rb', 'php']

                if (filePath) {
                  generatedFiles.push({
                    path: filePath,
                    workspacePath: context.workspacePath,
                    type: 'created',
                    size: toolArgs?.content ? String(toolArgs.content).length : undefined,
                  })
                }

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

              result = {
                toolCallId: toolCall.id,
                toolName,
                success: toolResult.success,
                observation,
              }
            } catch (error) {
              result = {
                toolCallId: toolCall.id,
                toolName,
                success: false,
                observation: `工具执行错误: ${(error as Error).message}`,
              }
            }
          }

          // CRITICAL: Update UI immediately when each tool completes
          // This provides real-time feedback for acting -> observing transition
          groupObservations.push(`${result.toolName}: ${result.observation}`)
          allResults.push(result)

          // Immediately update step to 'observing' status with streaming observation
          executionStore.updateReActStep(context.executionId, node.id, {
            id: stepId,
            status: 'observing',
            observation: groupObservations.join('\n\n'),
            observationStreaming: true,
            observationError: !result.success,
          })

          // Yield to allow React to render
          await new Promise(resolve => setTimeout(resolve, 0))

          return result
        }))

        // Process results and add to messages
        for (const result of allResults) {
          messages.push({ role: 'tool', content: result.observation, tool_call_id: result.toolCallId })

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: result.success ? 'info' : 'error',
            message: `观察: ${result.observation.slice(0, 200)}${result.observation.length > 200 ? '...' : ''}`,
          })

          if (data.stream) {
            const truncatedObs = result.observation.length > 500 ? result.observation.slice(0, 500) + '...' : result.observation
            context.onStream?.(node.id, `👁 观察: ${truncatedObs}\n`)
          }
        }

        // Sync todos state after each group
        const todosStatus = todosManager.getStatus()
        executionStore.updateReActTodos(context.executionId, node.id, todosStatus.items)

        // Early stopping: check if all tasks are complete
        if (todosStatus.total > 0 && todosStatus.pending === 0) {
          // Get current ReAct state for step information
          const reactState = executionStore.getReActState(context.executionId, node.id)

          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'info',
            message: `所有任务完成，正在生成总结...`,
          })

          if (data.stream) {
            context.onStream?.(node.id, `\n✅ 所有任务完成，正在生成总结...\n`)
          }

          // Use LLM to generate intelligent summary
          finalAnswer = await generateTaskSummary(
            client,
            data.model,
            messages,
            todosStatus,
            reactState?.steps || []
          )

          executionStore.setReActFinalAnswer(context.executionId, node.id, finalAnswer)

          if (data.stream) {
            context.onStream?.(node.id, `\n📝 总结: ${finalAnswer}\n`)
          }
          break
        }
      }

      // Mark step as completed and stop observation streaming
      executionStore.updateReActStep(context.executionId, node.id, {
        id: stepId,
        observationStreaming: false,
      })
      executionStore.completeReActStep(context.executionId, node.id, stepId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'error',
        message: `API 请求失败: ${errorMessage}`,
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
    message: `ReAct 智能体执行完成，迭代次数: ${iteration}`,
  })

  return {
    response: finalAnswer,
    generatedFiles,
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

  context.onLog?.({
    nodeId,
    nodeName: nodeData.label,
    level: 'info',
    message: `用户输入: ${userInput.slice(0, 100)}...`,
  })

  // Get API configuration from global config
  const aiConfig = await resolveAIConfig()
  const apiKey = aiConfig.apiKey || 'ollama' // Ollama doesn't require API key, use placeholder
  const apiEndpoint = aiConfig.apiEndpoint

  const client = new OpenAIClient(apiKey, apiEndpoint)

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
  const currentReactState = executionStore.getReActState(context.executionId, nodeId)!

  let iteration = currentReactState.currentIteration
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
      model: nodeData.model,
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
  }
}
