/**
 * 智能Agent执行器
 * 支持意图识别、工作流调用和流式输出
 */

import type { LLMProvider } from './react-agent/llm/types'
import type { WorkflowInfo, InputNodeMeta } from './workflow-registry'
import { getWorkflowAsTool, loadWorkflowInputMeta } from './workflow-registry'
import { executeWorkflowAsSubAgent } from './tools/workflow-executor'
import { TodosManager } from './tools'
import type {
  ToolCallRecord,
  ToolType,
  AgentStep,
  GeneratedFileInfo,
  WorkflowCallRecord,
} from '@/store/agent-store'
import { generateStepId } from '@/store/agent-store'
import { OpenAIClient, type OpenAIMessage, type OpenAITool, type OpenAIToolCall } from './openai-client'
import type { TodoItem } from '@/types/node'
import {
  compressOpenAIContext,
  compressOpenAIContextWithLLM,
  getContextConfig,
  estimateMessageTokens,
  type GenericMessage,
  type HybridCompressionOptions,
} from './react-agent/context-compressor'
import { analyzeToolDependencies } from './utils/tool-dependencies'

const DEBUG = false
const log = (...args: unknown[]) => DEBUG && console.log('[AgentExecutor]', ...args)

// 数据转换系统提示词
const TRANSFORM_SYSTEM_PROMPT = `你是一个数据格式转换专家。你的任务是将输入数据转换为指定的格式。

规则：
1. 严格按照目标格式要求进行转换
2. 如果输入数据不完整或无法解析，返回空值或合理的默认值
3. 只输出转换后的数据，不要添加任何解释或说明
4. 对于 JSON 格式，确保输出是有效的 JSON
5. 对于结构化数据，保持数据的准确性和完整性`

// 格式匹配分析结果
interface FormatMatchResult {
  needsTransform: boolean    // 是否需要转换
  reason: string             // 原因说明
  transformHint?: string     // 转换提示
}

// 历史消息格式
export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

// Agent配置
export interface AgentConfig {
  provider: LLMProvider
  model: string
  apiEndpoint?: string
  apiKey?: string
  workflows: WorkflowInfo[]
  history?: HistoryMessage[]  // 对话历史
  sandboxPath?: string        // 沙箱目录路径
}

// Agent回调（增强版，支持流式）
export interface AgentCallbacks {
  // 流式回调
  onThoughtChunk?: (chunk: string) => void
  onResponseChunk?: (chunk: string) => void
  onReasoningChunk?: (chunk: string) => void // 推理内容流式回调（DeepSeek R1 等）

  // 步骤回调
  onStepStart?: (step: AgentStep) => void
  onStepUpdate?: (stepId: string, update: Partial<AgentStep>) => void
  onStepComplete?: (stepId: string) => void

  // 工具调用回调
  onToolCallStart?: (toolCall: ToolCallRecord) => void
  onToolCallUpdate?: (toolCallId: string, update: Partial<ToolCallRecord>, index?: number) => void
  onToolCallComplete?: (toolCallId: string, result: { output?: unknown; error?: string }, index?: number) => void
  // 并行工具调用回调
  onToolCallsStart?: (toolCalls: ToolCallRecord[]) => void

  // 任务回调
  onTodosUpdate?: (items: TodoItem[]) => void

  // 工作流回调（保留兼容性）
  onWorkflowCall?: (call: WorkflowCallRecord) => void
  onWorkflowUpdate?: (index: number, update: Partial<WorkflowCallRecord>) => void

  // 文件生成回调
  onFilesGenerated?: (files: GeneratedFileInfo[]) => void

  // 完成回调
  onComplete?: (response: string, generatedFiles?: GeneratedFileInfo[]) => void
  onError?: (error: string) => void

  // 迭代限制回调
  onIterationLimitReached?: (currentIteration: number, maxIterations: number) => void

  // 兼容旧回调
  onThought?: (thought: string) => void
  onAction?: (action: string, input: unknown) => void
  onObservation?: (observation: string) => void
}

// LLM 响应结果
interface LLMResponse {
  content: string
  toolCalls?: OpenAIToolCall[]
}

// 最大迭代次数
const MAX_ITERATIONS = 10

/**
 * 智能Agent执行器（支持流式输出）
 */
export class IntelligentAgentExecutor {
  private config: AgentConfig
  private callbacks: AgentCallbacks
  private openaiClient: OpenAIClient | null = null
  private todosManager: TodosManager
  private workflowCallIndex = 0
  private signal?: AbortSignal
  private currentIteration = 0
  private currentStepId: string | null = null
  private generatedFiles: GeneratedFileInfo[] = []  // 收集生成的文件

  constructor(config: AgentConfig, callbacks: AgentCallbacks) {
    this.config = config
    this.callbacks = callbacks
    this.todosManager = new TodosManager()

    // 添加沙箱配置的调试日志
    console.log('[🏖️ AGENT_EXECUTOR] 构造函数 - 沙箱配置', {
      sandboxPath: config.sandboxPath,
      hasSandbox: !!config.sandboxPath,
    })
  }

  /**
   * 执行Agent
   */
  async execute(userInput: string, signal?: AbortSignal): Promise<string> {
    this.signal = signal
    this.currentIteration = 0
    this.generatedFiles = []  // 重置生成的文件列表

    console.log('[🏖️ AGENT_EXECUTOR] execute 开始', {
      sandboxPath: this.config.sandboxPath,
      hasSandbox: !!this.config.sandboxPath,
    })

    try {
      // 初始化客户端
      this.initializeClients()

      // 构建系统提示
      const systemPrompt = this.buildSystemPrompt()

      // 构建消息数组（包含历史上下文）
      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
      ]

      // 添加历史消息
      if (this.config.history && this.config.history.length > 0) {
        for (const msg of this.config.history) {
          messages.push({
            role: msg.role,
            content: msg.content,
          })
        }
      }

      // 添加当前用户输入
      messages.push({ role: 'user', content: userInput })

      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        if (this.signal?.aborted) {
          throw new Error('执行已取消')
        }

        this.currentIteration = iteration + 1
        log(`迭代 ${this.currentIteration}/${MAX_ITERATIONS}`)

        // 创建新的思考步骤
        this.currentStepId = generateStepId()
        const thinkingStep: AgentStep = {
          id: this.currentStepId,
          iteration: this.currentIteration,
          maxIterations: MAX_ITERATIONS,
          status: 'thinking',
          thought: '',
          thoughtStreaming: true,
          startedAt: Date.now(),
        }
        this.callbacks.onStepStart?.(thinkingStep)

        // 上下文压缩：检查并在需要时压缩消息历史
        const compressedMessages = await this.compressMessagesIfNeeded(messages)

        // 调用LLM（流式）- 统一使用 OpenAI 兼容 API
        const response = await this.callOpenAIStream(compressedMessages)

        // 更新思考步骤状态
        this.callbacks.onStepUpdate?.(this.currentStepId, {
          thoughtStreaming: false,
          thought: response.content,
        })

        // 检查是否有工具调用
        if (response.toolCalls && response.toolCalls.length > 0) {
          // 添加助手消息
          messages.push({
            role: 'assistant',
            content: response.content,
            tool_calls: response.toolCalls,
          })

          // 更新步骤状态为 acting
          this.callbacks.onStepUpdate?.(this.currentStepId, {
            status: 'acting',
          })

          // 分析工具依赖关系，分组并行执行
          const toolCallGroups = analyzeToolDependencies(response.toolCalls)
          log('工具依赖分组:', toolCallGroups.map(g => g.map(t => t.toolCall.function.name)))

          // 为当前步骤创建所有工具调用记录
          const allToolCallRecords: ToolCallRecord[] = response.toolCalls.map((tc, idx) => {
            const toolType: ToolType = tc.function.name.startsWith('workflow_') ? 'workflow' : 'builtin'
            let args: Record<string, unknown> = {}
            try {
              args = JSON.parse(tc.function.arguments || '{}')
            } catch {
              args = {}
            }
            return {
              id: `tc_${Date.now()}_${idx}`,
              toolName: tc.function.name,
              toolType,
              status: 'pending' as const,
              input: args,
              startedAt: Date.now(),
            }
          })

          // 通知所有工具调用开始
          this.callbacks.onToolCallsStart?.(allToolCallRecords)

          // 按组执行
          for (const group of toolCallGroups) {
            if (this.signal?.aborted) {
              throw new Error('执行已取消')
            }

            // 同一组内的工具并行执行
            const groupResults = await Promise.allSettled(
              group.map(({ toolCall, index }) =>
                this.executeToolCallWithRecord(toolCall, allToolCallRecords[index], index)
              )
            )

            // 收集观察结果并添加工具响应
            for (let i = 0; i < groupResults.length; i++) {
              const result = groupResults[i]
              const { toolCall } = group[i]

              if (result.status === 'fulfilled') {
                // 添加工具响应 - 统一使用 OpenAI 格式
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: result.value,
                })
              } else {
                // 错误处理
                const errorMsg = `执行错误: ${result.reason}`
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: errorMsg,
                })
              }
            }
          }

          // 所有工具执行完成，更新步骤状态为 completed
          this.callbacks.onStepUpdate?.(this.currentStepId, {
            status: 'completed',
            completedAt: Date.now(),
          })
          this.callbacks.onStepComplete?.(this.currentStepId)
        } else {
          // 没有工具调用，返回最终答案
          this.callbacks.onStepUpdate?.(this.currentStepId, {
            status: 'completed',
            completedAt: Date.now(),
          })
          this.callbacks.onStepComplete?.(this.currentStepId)
          this.callbacks.onComplete?.(response.content, this.generatedFiles)
          console.log('[🏖️ AGENT_EXECUTOR] onComplete 调用', {
            responseLength: response.content?.length,
            generatedFilesCount: this.generatedFiles.length,
            generatedFiles: this.generatedFiles,
          })
          return response.content
        }
      }

      // 达到最大迭代次数
      console.log('[🏖️ AGENT_EXECUTOR] 达到最大迭代', {
        currentIteration: this.currentIteration,
        maxIterations: MAX_ITERATIONS,
        generatedFilesCount: this.generatedFiles.length,
      })

      // 触发迭代限制回调
      this.callbacks.onIterationLimitReached?.(this.currentIteration, MAX_ITERATIONS)

      // 不再直接调用 onComplete，让 AgentPage 处理
      return ''  // 返回空字符串，表示需要用户确认

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log('执行错误:', errorMessage)
      this.callbacks.onError?.(errorMessage)
      throw error
    }
  }

  /**
   * 初始化客户端
   * 统一使用 OpenAI 兼容 API
   */
  private initializeClients() {
    // 统一使用 OpenAI 兼容 API
    this.openaiClient = new OpenAIClient(
      this.config.apiKey || '',
      this.config.apiEndpoint || 'https://api.openai.com/v1'
    )
  }

  /**
   * OpenAI 流式调用（使用新的 chatStreamWithTools 方法）
   * 统一用于所有 provider
   */
  private async callOpenAIStream(messages: OpenAIMessage[]): Promise<LLMResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI客户端未初始化')
    }

    const tools = this.getOpenAITools()

    try {
      // 使用新的流式方法，一次调用获取内容和工具调用
      const response = await this.openaiClient.chatStreamWithTools(
        {
          model: this.config.model,
          messages,
          tools,
          stream: true,
        },
        (chunk) => {
          if (this.signal?.aborted) {
            throw new Error('执行已取消')
          }
          // 回调流式内容
          this.callbacks.onThoughtChunk?.(chunk)
          this.callbacks.onThought?.(chunk)
        },
        undefined, // onToolCallName
        (chunk) => {
          // 回调推理内容（DeepSeek R1 等）
          this.callbacks.onReasoningChunk?.(chunk)
        }
      )

      return {
        content: response.content || '',
        toolCalls: response.tool_calls,
      }
    } catch (error) {
      // 如果流式失败，尝试非流式（某些API不支持流式+工具调用）
      log('流式调用失败，回退到非流式:', error)
      const response = await this.openaiClient.chat({
        model: this.config.model,
        messages,
        tools,
        stream: false,
      })

      // 一次性回调内容
      if (response.content) {
        this.callbacks.onThoughtChunk?.(response.content)
        this.callbacks.onThought?.(response.content)
      }

      // 一次性回调推理内容
      if (response.reasoning_content) {
        this.callbacks.onReasoningChunk?.(response.reasoning_content)
      }

      return {
        content: response.content || '',
        toolCalls: response.tool_calls,
      }
    }
  }

  /**
   * 获取OpenAI工具格式
   */
  private getOpenAITools(): OpenAITool[] {
    const tools: OpenAITool[] = []

    // 添加工作流工具
    for (const workflow of this.config.workflows) {
      const toolDef = getWorkflowAsTool(workflow)
      tools.push({
        type: 'function',
        function: {
          name: toolDef.name,
          description: toolDef.description,
          parameters: toolDef.parameters as OpenAITool['function']['parameters'],
        },
      })
    }

    // 添加内置工具
    tools.push({
      type: 'function',
      function: {
        name: 'todos',
        description: '任务规划与跟踪工具。建议接到任务后首先使用此工具创建任务列表来规划步骤。',
        parameters: {
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
          },
          required: ['action'],
        },
      },
    })

    tools.push({
      type: 'function',
      function: {
        name: 'getCurrentDate',
        description: '获取当前日期和时间',
        parameters: {
          type: 'object',
          properties: {
            format: { type: 'string', description: '格式: full, date, time, timestamp' },
          },
          required: [],
        },
      },
    })

    // 文件操作工具（仅在沙箱目录中操作）
    tools.push({
      type: 'function',
      function: {
        name: 'readFile',
        description: '读取沙箱目录中的文件内容',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: '相对于沙箱目录的文件路径' },
          },
          required: ['filePath'],
        },
      },
    })

    tools.push({
      type: 'function',
      function: {
        name: 'writeFile',
        description: '将内容写入沙箱目录中的文件，自动创建所需的子目录',
        parameters: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: '相对于沙箱目录的文件路径' },
            content: { type: 'string', description: '文件内容' },
          },
          required: ['filename', 'content'],
        },
      },
    })

    tools.push({
      type: 'function',
      function: {
        name: 'writeMultipleFiles',
        description: '批量写入多个文件到沙箱目录',
        parameters: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  filename: { type: 'string' },
                  content: { type: 'string' },
                },
                required: ['filename', 'content'],
              },
            },
          },
          required: ['files'],
        },
      },
    })

    tools.push({
      type: 'function',
      function: {
        name: 'listFiles',
        description: '列出沙箱目录中的文件和子目录',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '相对于沙箱目录的路径，默认为根目录' },
          },
          required: [],
        },
      },
    })

    tools.push({
      type: 'function',
      function: {
        name: 'executeCommand',
        description: '在沙箱目录中执行 Shell 命令，有30秒超时限制',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的命令' },
          },
          required: ['command'],
        },
      },
    })

    return tools
  }

  /**
   * 构建系统提示
   */
  private buildSystemPrompt(): string {
    const now = new Date()
    const currentDate = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
    const currentTime = now.toLocaleTimeString('zh-CN')
    const currentTimeInfo = `${currentDate} ${currentTime}`

    const workflowDescriptions = this.config.workflows
      .map((w, i) => `${i + 1}. **${w.name}**: ${w.description || '无描述'} (路径: ${w.workspacePath})`)
      .join('\n')

    return `你是一个智能助手，可以帮助用户完成各种任务。

**当前时间**: ${currentTimeInfo}

你可以访问以下工作流（子智能体）：

${workflowDescriptions || '（暂无可用工作流）'}

## 重要规则

**在选择工作流之前，必须仔细阅读工作流的描述，确保工作流的功能与用户请求匹配。**
- 如果用户请求的功能与所有工作流都不匹配，直接使用你自己的知识回答用户问题
- 不要强行调用不相关的工作流

## 工具使用说明

1. **工作流调用**: 使用 workflow_xxx 工具来执行对应的工作流。
   - 输入参数通过 input 字段传递，可以是字符串或对象
   - 示例: {"input": "北京天气"} 或 {"input": {"city": "北京"}}
   - 调用前确保工作流的功能描述与用户请求匹配

2. **todos**: 管理待办事项列表，用于规划和跟踪任务进度。
   - 初始化: {"action": "init", "tasks": ["任务1", "任务2"]}
   - 添加: {"action": "add", "content": "新任务"}
   - 完成: {"action": "complete", "content": "任务内容"}
   - 列表: {"action": "list"}

3. **getCurrentDate**: 获取当前日期时间。

## 文件操作工具

所有文件操作都在沙箱目录中执行，每个对话有独立的沙箱空间，文件路径相对于沙箱目录。

4. **readFile**: 读取文件内容
   - 参数: {"filePath": "data.json"}
   - 返回文件的完整内容

5. **writeFile**: 写入文件
   - 参数: {"filename": "output.txt", "content": "文件内容"}
   - 自动创建所需的子目录

6. **writeMultipleFiles**: 批量写入多个文件
   - 参数: {"files": [{"filename": "a.txt", "content": "..."}, {"filename": "b.txt", "content": "..."}]}
   - 适用于生成多个相关文件

7. **listFiles**: 列出目录内容
   - 参数: {"path": "subdir"} (可选，默认为根目录)
   - 返回文件和子目录列表

8. **executeCommand**: 执行 Shell 命令
   - 参数: {"command": "python script.py"}
   - 在沙箱目录中执行，有30秒超时限制
   - 可用于运行脚本、处理数据等

## ⚡ 核心能力：并行工具调用

**你可以在一次响应中同时返回多个 tool_calls 来并行执行独立的操作。但必须确保这些操作之间没有依赖关系！**

### 并行调用规则

**✅ 应该并行执行（无依赖关系）：**
- 读取多个不同的文件：一次返回多个 readFile 调用
- 调用**多个不同的**工作流处理**独立的**任务（如同时查询北京和上海的天气，使用两个不同的天气工作流）
- 文件操作和工作流调用同时进行（如果工作流不依赖文件操作的结果）

**❌ 必须串行执行（有依赖关系）：**
- 先写入文件再读取同一文件
- 先写入脚本再执行该脚本
- todos 操作需要按顺序执行
- **同一个工作流的多次调用必须串行执行**（如：先查询北京天气，再用结果绘制图表，即使都用同一个工作流）
- **一个工作流的输入依赖另一个工作流的输出**（如：先获取数据，再基于数据绘图）
- **任务之间存在因果顺序**（如：先分析需求，再基于分析结果执行操作）

### 判断依赖的关键
在返回多个 tool_calls 之前，问自己：
- 这些操作之间是否有先后顺序？
- 后面的操作是否需要前面操作的结果？
- 如果答案是"是"，则必须分多次响应，串行执行

### 并行调用示例

**用户请求：** "读取 config.json 和 package.json 并比较它们的版本号"

**正确做法（并行）：** 在一次响应中返回两个 tool_calls：
\`\`\`
tool_calls: [
  { function: { name: "readFile", arguments: '{"filePath": "config.json"}' } },
  { function: { name: "readFile", arguments: '{"filePath": "package.json"}' } }
]
\`\`\`

**用户请求：** "同时查询北京天气和上海股市"

**正确做法（并行）：** 一次返回两个不同工作流的调用：
\`\`\`
tool_calls: [
  { function: { name: "workflow_weather", arguments: '{"input": "北京天气"}' } },
  { function: { name: "workflow_stock", arguments: '{"input": "上海股市"}' } }
]
\`\`\`

### 串行调用示例

**用户请求：** "帮我查看武汉的天气信息并绘制成图表"

**正确做法（串行）：** 分两步执行，因为绘图需要天气数据作为输入
- 第一步：返回 \`tool_calls: [{ name: "workflow_weather", arguments: '{"input": "武汉天气"}' }]\`
- 等待天气数据返回后
- 第二步：返回 \`tool_calls: [{ name: "workflow_chart", arguments: '{"input": "根据以下天气数据绘制图表: ..."}' }]\`

**错误做法（并行）：** 一次返回两个 tool_calls，因为绘图依赖天气数据的结果

**用户请求：** "查询北京、上海、广州的天气"

**错误做法（并行）：** 一次返回多次相同工作流的调用
\`\`\`javascript
// ❌ 错误！同一工作流不能并行调用
tool_calls: [
  { function: { name: "workflow_weather", arguments: '{"input": "北京"}' } },
  { function: { name: "workflow_weather", arguments: '{"input": "上海"}' } },
  { function: { name: "workflow_weather", arguments: '{"input": "广州"}' } }
]
\`\`\`

**正确做法（串行）：** 分三次调用同一工作流
\`\`\`javascript
// ✅ 第一次：查询北京天气
tool_calls: [{ name: "workflow_weather", arguments: '{"input": "北京"}' }]

// ✅ 第二次（收到第一次结果后）：查询上海天气
tool_calls: [{ name: "workflow_weather", arguments: '{"input": "上海"}' }]

// ✅ 第三次（收到第二次结果后）：查询广州天气
tool_calls: [{ name: "workflow_weather", arguments: '{"input": "广州"}' }]
\`\`\`

**重要说明：** 同一个工作流（workflow_*）的多次调用必须串行执行。只有不同的工作流可以并行调用。

---

## 任务规划指南

**对于复杂任务，你应该主动使用 todos 工具来规划和跟踪进度：**

### 如何使用 todos
1. **任务开始时**: 使用 \`init\` 初始化任务列表
   \`\`\`json
   {"action": "init", "tasks": ["分析用户需求", "调用相关工具", "整理返回结果"]}
   \`\`\`

2. **任务执行中**: 完成一个步骤后，立即使用 \`complete\` 标记
   \`\`\`json
   {"action": "complete", "content": "分析用户需求"}
   \`\`\`

3. **发现新任务**: 使用 \`add\` 添加新发现的子任务

### 示例
用户: "帮我分析项目并生成报告"
你的操作:
1. 调用 todos: {"action": "init", "tasks": ["分析项目结构", "收集关键信息", "生成分析报告"]}
2. 执行分析... 完成后: {"action": "complete", "content": "分析项目结构"}
3. 收集信息... 完成后: {"action": "complete", "content": "收集关键信息"}
4. 生成报告... 完成后: {"action": "complete", "content": "生成分析报告"}

## 工作流程

当用户提出请求时：
1. **分析任务复杂度** - 如果是多步骤任务，先用 todos 初始化任务列表
2. 分析用户意图
3. 检查是否有匹配的工作流（根据工作流描述判断）
4. 如果有匹配的工作流，调用它并解读返回结果
5. 每完成一个关键步骤，更新 todos 状态
6. 如果没有匹配的工作流，直接使用你的知识回答用户问题
7. 如果工作流执行失败，可以尝试其他方案或直接回答

## 注意事项

- 工作流输入应该是简洁明确的值，直接把用户的核心需求作为 input 传递
- 不要重复调用同一个失败的工作流
- 复杂任务务必使用 todos 跟踪进度，让用户了解执行状态
- 保持回复简洁，使用中文`
  }

  /**
   * 执行工具调用（带预创建记录，用于并行执行）
   */
  private async executeToolCallWithRecord(
    toolCall: OpenAIToolCall,
    record: ToolCallRecord,
    index: number
  ): Promise<string> {
    const { name } = toolCall.function
    let args: Record<string, unknown>

    try {
      args = JSON.parse(toolCall.function.arguments)
    } catch {
      args = {}
    }

    log('执行工具 (并行):', name, args, 'index:', index)

    // 更新状态为运行中
    this.callbacks.onToolCallUpdate?.(record.id, { status: 'running' }, index)
    this.callbacks.onAction?.(name, args)

    try {
      let result: string

      if (name.startsWith('workflow_')) {
        result = await this.executeWorkflow(name, args, record.id)
      } else {
        result = await this.executeBuiltinTool(name, args, record.id)
      }

      // 更新工具调用状态为完成
      const completedAt = Date.now()
      this.callbacks.onToolCallUpdate?.(record.id, {
        status: 'completed',
        output: result,
        completedAt,
        duration: completedAt - record.startedAt,
      }, index)
      this.callbacks.onToolCallComplete?.(record.id, { output: result }, index)

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // 更新工具调用状态为错误
      this.callbacks.onToolCallUpdate?.(record.id, {
        status: 'error',
        error: errorMessage,
        completedAt: Date.now(),
      }, index)
      this.callbacks.onToolCallComplete?.(record.id, { error: errorMessage }, index)

      return `工具执行错误: ${errorMessage}`
    }
  }

  /**
   * 分析数据格式是否匹配目标输入要求
   */
  private analyzeFormatMatch(
    sourceData: unknown,
    targetInput: InputNodeMeta
  ): FormatMatchResult {
    const sourceType = typeof sourceData

    // 如果目标是 string 类型，检查是否需要特定格式
    if (targetInput.inputType === 'string') {
      // 检查 prompt 是否暗示需要特定格式
      const prompt = targetInput.prompt.toLowerCase()
      const needsStructure =
        prompt.includes('json') ||
        prompt.includes('结构化') ||
        prompt.includes('数组') ||
        prompt.includes('对象') ||
        prompt.includes('列表') ||
        prompt.includes('表格')

      if (needsStructure && sourceType === 'string') {
        // 源是字符串，但目标需要结构化数据
        return {
          needsTransform: true,
          reason: `目标需要结构化数据（${targetInput.prompt}），但源数据是文本`,
          transformHint: targetInput.prompt,
        }
      }

      return {
        needsTransform: false,
        reason: '目标接受文本输入',
      }
    }

    // 如果目标是 number 类型
    if (targetInput.inputType === 'number') {
      if (sourceType === 'number') {
        return { needsTransform: false, reason: '类型匹配' }
      }
      // 检查源字符串是否是纯数字
      if (sourceType === 'string' && /^\d+(\.\d+)?$/.test(sourceData as string)) {
        return { needsTransform: false, reason: '字符串可转换为数字' }
      }
      return {
        needsTransform: true,
        reason: `目标需要数字，但源数据是 ${sourceType}`,
        transformHint: '提取数值',
      }
    }

    // 如果目标是 boolean 类型
    if (targetInput.inputType === 'boolean') {
      if (sourceType === 'boolean') {
        return { needsTransform: false, reason: '类型匹配' }
      }
      return {
        needsTransform: true,
        reason: `目标需要布尔值，但源数据是 ${sourceType}`,
        transformHint: '判断真假',
      }
    }

    // 默认：不需要转换，让 SubAgent 自己处理
    return {
      needsTransform: false,
      reason: '未明确需要转换',
    }
  }

  /**
   * 使用 LLM 进行智能数据转换
   */
  private async transformDataForSubAgent(
    sourceData: unknown,
    targetInput: InputNodeMeta,
    workflowName: string
  ): Promise<string> {
    const sourceStr = typeof sourceData === 'string'
      ? sourceData
      : JSON.stringify(sourceData, null, 2)

    // 输入截断保护
    const maxInputLength = 5000
    const truncatedSource = sourceStr.length > maxInputLength
      ? sourceStr.slice(0, maxInputLength) + '...[已截断]'
      : sourceStr

    const typeDesc = {
      'string': '文本',
      'number': '数字',
      'boolean': '布尔值(true/false)',
    }[targetInput.inputType] || '任意'

    const transformPrompt = `你需要将以下数据转换为适合「${workflowName}」工作流使用的格式。

目标输入节点: ${targetInput.label}
数据类型要求: ${typeDesc}
功能描述: ${targetInput.prompt || '无特殊要求'}

源数据:
\`\`\`
${truncatedSource}
\`\`\`

请将源数据转换为目标输入节点需要的格式。
规则:
1. 如果目标是 string 类型且需要结构化数据(如JSON)，输出格式化后的字符串
2. 如果目标是 number 类型，只输出数字
3. 如果目标是 boolean 类型，只输出 true 或 false
4. 只输出转换后的数据，不要添加任何解释

转换结果:`

    try {
      if (!this.openaiClient) {
        return sourceStr
      }

      const response = await this.openaiClient.chat({
        model: this.config.model,
        messages: [
          { role: 'system', content: TRANSFORM_SYSTEM_PROMPT },
          { role: 'user', content: transformPrompt }
        ],
        temperature: 0.1,
        max_tokens: 4096,
        stream: false
      })

      return response.content || sourceStr
    } catch (error) {
      console.error('数据转换失败:', error)
      // 转换失败时返回原始数据
      return sourceStr
    }
  }

  /**
   * 执行内置工具
   */
  private async executeBuiltinTool(name: string, args: Record<string, unknown>, _toolCallId: string): Promise<string> {
    // 路径验证辅助函数 - 防止路径遍历攻击（纯 JS 实现，不依赖 Node.js path 模块）
    const validateSandboxPath = (relativePath: string): string | null => {
      if (!this.config.sandboxPath) {
        return null
      }
      // 规范化路径：移除开头的斜杠，处理 .. 和 . 分段
      let normalizedRelative = relativePath.replace(/^\/+/, '')

      // 检测路径遍历攻击
      const segments = normalizedRelative.split(/[/\\]/)
      const normalizedSegments: string[] = []
      for (const segment of segments) {
        if (segment === '..') {
          // 尝试返回上级目录 - 拒绝
          return null
        } else if (segment !== '.' && segment !== '') {
          normalizedSegments.push(segment)
        }
      }
      normalizedRelative = normalizedSegments.join('/')

      // 构建完整路径（使用 / 作为分隔符，因为我们在渲染进程中）
      const fullPath = this.config.sandboxPath.replace(/\\/g, '/') + '/' + normalizedRelative

      // 检查最终路径是否在沙箱目录内
      const sandboxPathNormalized = this.config.sandboxPath.replace(/\\/g, '/')
      if (!fullPath.startsWith(sandboxPathNormalized + '/') && fullPath !== sandboxPathNormalized) {
        return null
      }
      return fullPath
    }

    switch (name) {
      case 'todos': {
        // 验证 action 参数
        const action = args.action as 'add' | 'complete' | 'list' | 'remove' | 'clear' | 'init' | undefined
        const validActions = ['init', 'add', 'complete', 'list', 'remove', 'clear'] as const

        if (!action || !validActions.includes(action)) {
          const observation = `错误: 无效的 todos 操作。请使用 JSON 格式调用，例如: {"action": "init", "tasks": ["任务1", "任务2"]} 或 {"action": "complete", "content": "任务关键词"}`
          this.callbacks.onObservation?.(observation)
          return observation
        }

        const result = this.todosManager.execute(
          action,
          args.content as string | undefined,
          undefined,
          args.tasks as string[] | undefined
        )
        const observation = result.success ? result.output : `错误: ${result.error}`
        this.callbacks.onObservation?.(observation)

        // 同步任务列表到 UI
        const todosStatus = this.todosManager.getStatus()
        this.callbacks.onTodosUpdate?.(todosStatus.items)

        return observation
      }

      case 'getCurrentDate': {
        const format = (args.format as string) || 'full'
        const now = new Date()
        let result: string

        switch (format) {
          case 'date':
            result = now.toLocaleDateString('zh-CN')
            break
          case 'time':
            result = now.toLocaleTimeString('zh-CN')
            break
          case 'timestamp':
            result = String(Math.floor(now.getTime() / 1000))
            break
          default:
            result = now.toLocaleString('zh-CN')
        }

        this.callbacks.onObservation?.(result)
        return result
      }

      case 'readFile': {
        if (!this.config.sandboxPath) {
          const error = '错误: 沙箱未配置，无法读取文件'
          this.callbacks.onObservation?.(error)
          return error
        }
        const filePath = args.filePath as string
        if (!filePath) {
          const error = '错误: 未指定文件路径'
          this.callbacks.onObservation?.(error)
          return error
        }
        const validatedPath = validateSandboxPath(filePath)
        if (!validatedPath) {
          const error = `错误: 无效的文件路径或路径超出沙箱范围: ${filePath}`
          this.callbacks.onObservation?.(error)
          return error
        }
        try {
          const result = await window.electronAPI.file.read(this.config.sandboxPath, filePath.replace(/^\/+/, ''))
          if (!result.success) {
            const error = `读取文件失败: ${result.error}`
            this.callbacks.onObservation?.(error)
            return error
          }
          this.callbacks.onObservation?.(result.content || '')
          return result.content || ''
        } catch (error) {
          const errorMsg = `读取文件错误: ${(error as Error).message}`
          this.callbacks.onObservation?.(errorMsg)
          return errorMsg
        }
      }

      case 'writeFile': {
        if (!this.config.sandboxPath) {
          const error = '错误: 沙箱未配置，无法写入文件'
          this.callbacks.onObservation?.(error)
          return error
        }
        const filename = (args.filename as string) || (args.filePath as string)
        const content = args.content as string
        if (!filename) {
          const error = '错误: 未指定文件名'
          this.callbacks.onObservation?.(error)
          return error
        }
        const validatedPath = validateSandboxPath(filename)
        if (!validatedPath) {
          const error = `错误: 无效的文件路径: ${filename}`
          this.callbacks.onObservation?.(error)
          return error
        }
        try {
          const normalizedPath = filename.replace(/^\/+/, '')
          const result = await window.electronAPI.file.write(this.config.sandboxPath, normalizedPath, content || '')
          if (!result.success) {
            const error = `写入文件失败: ${result.error}`
            this.callbacks.onObservation?.(error)
            return error
          }
          this.generatedFiles.push({
            path: normalizedPath,
            workspacePath: this.config.sandboxPath,
            type: 'created',
            size: content?.length,
          })
          const successMsg = `文件已写入: ${filename}`
          this.callbacks.onObservation?.(successMsg)
          return successMsg
        } catch (error) {
          const errorMsg = `写入文件错误: ${(error as Error).message}`
          this.callbacks.onObservation?.(errorMsg)
          return errorMsg
        }
      }

      case 'writeMultipleFiles': {
        if (!this.config.sandboxPath) {
          const error = '错误: 沙箱未配置，无法写入文件'
          this.callbacks.onObservation?.(error)
          return error
        }
        const files = args.files as Array<{ filename: string; content: string }>
        if (!Array.isArray(files) || files.length === 0) {
          const error = '错误: 未提供有效的文件列表'
          this.callbacks.onObservation?.(error)
          return error
        }
        const results: string[] = []
        let successCount = 0
        for (const file of files) {
          const filename = file.filename || (file as Record<string, unknown>).filePath as string
          const content = file.content || ''
          if (!filename) {
            results.push(`❌ 跳过: 缺少文件名`)
            continue
          }
          const validatedPath = validateSandboxPath(filename)
          if (!validatedPath) {
            results.push(`❌ ${filename}: 路径超出沙箱范围`)
            continue
          }
          try {
            const normalizedPath = filename.replace(/^\/+/, '')
            const result = await window.electronAPI.file.write(this.config.sandboxPath, normalizedPath, content)
            if (result.success) {
              // 收集生成的文件信息
              this.generatedFiles.push({
                path: normalizedPath,
                workspacePath: this.config.sandboxPath,
                type: 'created',
                size: content?.length,
              })
              results.push(`✅ ${filename}`)
              successCount++
            } else {
              results.push(`❌ ${filename}: ${result.error || '写入失败'}`)
            }
          } catch (error) {
            results.push(`❌ ${filename}: ${(error as Error).message}`)
          }
        }
        const output = `批量写入完成 (${successCount}/${files.length}):\n${results.join('\n')}`
        this.callbacks.onObservation?.(output)
        return output
      }

      case 'listFiles': {
        if (!this.config.sandboxPath) {
          const error = '错误: 沙箱未配置，无法列出文件'
          this.callbacks.onObservation?.(error)
          return error
        }
        const listPath = ((args.path as string) || '.').replace(/^\/+/, '')
        const validatedPath = validateSandboxPath(listPath)
        if (!validatedPath) {
          const error = `错误: 无效的路径或路径超出沙箱范围: ${listPath}`
          this.callbacks.onObservation?.(error)
          return error
        }
        try {
          const result = await window.electronAPI.file.list(this.config.sandboxPath, listPath || undefined)
          if (!result.success) {
            const error = `列出文件失败: ${result.error}`
            this.callbacks.onObservation?.(error)
            return error
          }
          const files = result.files || []
          if (files.length === 0) {
            const output = '目录为空'
            this.callbacks.onObservation?.(output)
            return output
          }
          const output = files.map(f => `${f.isDirectory ? '📁' : '📄'} ${f.name}`).join('\n')
          this.callbacks.onObservation?.(output)
          return output
        } catch (error) {
          const errorMsg = `列出文件错误: ${(error as Error).message}`
          this.callbacks.onObservation?.(errorMsg)
          return errorMsg
        }
      }

      case 'executeCommand': {
        if (!this.config.sandboxPath) {
          const error = '错误: 沙箱未配置，无法执行命令'
          this.callbacks.onObservation?.(error)
          return error
        }
        const command = args.command as string
        if (!command) {
          const error = '错误: 未指定要执行的命令'
          this.callbacks.onObservation?.(error)
          return error
        }
        try {
          const result = await window.electronAPI.command.execute(this.config.sandboxPath, {
            command,
            cwd: '.', // 在沙箱目录中执行
            timeout: 30000,
          })
          let output = ''
          if (result.stdout) {
            output += result.stdout
          }
          if (result.stderr) {
            output += (output ? '\n' : '') + `stderr: ${result.stderr}`
          }
          if (!result.success) {
            output += (output ? '\n' : '') + `命令执行失败，退出码: ${result.exitCode}`
            if (result.timedOut) {
              output += ' (超时)'
            }
          }
          this.callbacks.onObservation?.(output || '命令执行完成（无输出）')
          return output || '命令执行完成（无输出）'
        } catch (error) {
          const errorMsg = `执行命令错误: ${(error as Error).message}`
          this.callbacks.onObservation?.(errorMsg)
          return errorMsg
        }
      }

      default:
        const error = `未知工具: ${name}`
        this.callbacks.onObservation?.(error)
        return error
    }
  }

  /**
   * 执行工作流
   */
  private async executeWorkflow(toolName: string, args: Record<string, unknown>, toolCallId: string): Promise<string> {
    // 从工具名提取工作流 ID
    const workflowId = toolName.replace('workflow_', '')

    // 使用 ID 查找工作流
    const workflow = this.config.workflows.find((w) => w.id === workflowId)

    if (!workflow) {
      const error = `找不到工作流: ${workflowId}`
      this.callbacks.onObservation?.(error)
      return error
    }

    // 记录工作流调用（兼容旧API）
    const callIndex = this.workflowCallIndex++
    const call: WorkflowCallRecord = {
      workflowName: workflow.name,
      workspacePath: workflow.workspacePath,
      input: args.input || args,
      status: 'pending',
    }
    this.callbacks.onWorkflowCall?.(call)

    // 更新状态为运行中
    this.callbacks.onWorkflowUpdate?.(callIndex, { status: 'running' })

    // 更新工具调用元数据
    this.callbacks.onToolCallUpdate?.(toolCallId, {
      metadata: {
        workflowPath: workflow.workspacePath,
      },
    })

    // 准备工作流输入参数（带智能格式转换）
    let workflowInput: Record<string, unknown>

    // === 智能格式转换 ===
    // 加载工作流输入节点元信息
    let inputNodesMeta: InputNodeMeta[] = workflow.inputNodes || []

    // 如果工作流没有预加载的输入节点信息，尝试动态加载
    if (inputNodesMeta.length === 0) {
      try {
        inputNodesMeta = await loadWorkflowInputMeta(workflow.workspacePath)
      } catch (e) {
        log('动态加载输入节点元信息失败:', e)
      }
    }

    if (inputNodesMeta.length > 0) {
      // 有输入节点元信息，进行智能匹配和转换
      workflowInput = {}

      for (const inputMeta of inputNodesMeta) {
        // 尝试从 args 中匹配输入值
        let inputValue: unknown = args[inputMeta.label] ?? args.input ?? Object.values(args)[0]

        if (inputValue !== undefined && inputValue !== null) {
          // 分析格式匹配
          const matchResult = this.analyzeFormatMatch(inputValue, inputMeta)

          if (matchResult.needsTransform) {
            // 记录转换日志
            log(`格式转换: ${matchResult.reason}`)

            // 执行转换
            inputValue = await this.transformDataForSubAgent(
              inputValue,
              inputMeta,
              workflow.name
            )
          }
        }

        workflowInput[inputMeta.label] = inputValue
      }
    } else {
      // 没有输入节点信息，使用原有逻辑
      if (args.input !== undefined) {
        if (typeof args.input === 'object' && args.input !== null) {
          workflowInput = args.input as Record<string, unknown>
        } else {
          workflowInput = { input: args.input }
        }
      } else {
        workflowInput = args
      }
    }
    // === 智能格式转换结束 ===

    log('工作流输入参数:', workflowInput)

    // 更新工具调用状态为运行中（用于进度展示）
    this.callbacks.onToolCallUpdate?.(toolCallId, {
      subAgentProgress: {
        workflowName: workflow.name,
        workflowPath: workflow.workspacePath,
        status: 'loading',
        startedAt: Date.now(),
        updatedAt: Date.now(),
      },
    })

    try {
      // 执行工作流（简化版回调）
      const result = await executeWorkflowAsSubAgent(
        workflow.workspacePath,
        workflowInput,
        {
          apiEndpoint: this.config.apiEndpoint,
          apiKey: this.config.apiKey,
          onLog: (msg) => {
            log(`[${workflow.name}] ${msg}`)
          },
          onProgress: {
            onStatusChange: (status) => {
              log('SubAgent 状态变化:', status)
              this.callbacks.onToolCallUpdate?.(toolCallId, {
                subAgentProgress: {
                  status,
                  updatedAt: Date.now(),
                } as any,
              })
            },
            onNodeStart: (nodeName, _nodeId, nodeType) => {
              this.callbacks.onToolCallUpdate?.(toolCallId, {
                subAgentProgress: {
                  status: 'running',
                  currentNode: nodeName,
                  currentNodeType: nodeType,
                  updatedAt: Date.now(),
                } as any,
              })
            },
            onNodeComplete: (_nodeName, _nodeId, _success) => {
              // 节点完成，不需要特殊处理
            },
            onProgress: (completedNodes, totalNodes) => {
              this.callbacks.onToolCallUpdate?.(toolCallId, {
                subAgentProgress: {
                  status: 'running',
                  completedNodes,
                  totalNodes,
                  updatedAt: Date.now(),
                } as any,
              })
            },
            onLog: (msg) => {
              log(`[${workflow.name}] ${msg}`)
            },
            onReActStepsUpdate: (nodeName, _nodeId, steps, iteration, maxIterations) => {
              // 更新 ReAct Agent 的嵌套步骤（保留现有进度信息）
              this.callbacks.onToolCallUpdate?.(toolCallId, {
                subAgentProgress: {
                  currentNode: nodeName,
                  currentNodeType: 'reactAgent',
                  reactAgentSteps: steps,
                  reactAgentIteration: iteration,
                  reactAgentMaxIterations: maxIterations,
                  updatedAt: Date.now(),
                } as any,
              })
            },
          },
        }
      )

      if (result.success) {
        // 收集生成的文件
        if (result.generatedFiles && result.generatedFiles.length > 0) {
          this.generatedFiles.push(...result.generatedFiles)
          this.callbacks.onFilesGenerated?.(result.generatedFiles)
        }

        // 更新 SubAgent 状态为完成
        this.callbacks.onToolCallUpdate?.(toolCallId, {
          subAgentProgress: {
            workflowName: workflow.name,
            workflowPath: workflow.workspacePath,
            status: 'completed',
            completedNodes: result.totalNodes,
            totalNodes: result.totalNodes,
            startedAt: Date.now(),
            updatedAt: Date.now(),
          },
        })

        // 更新状态为完成
        this.callbacks.onWorkflowUpdate?.(callIndex, {
          status: 'completed',
          output: result.output,
        })

        const outputStr = typeof result.output === 'object'
          ? JSON.stringify(result.output, null, 2)
          : String(result.output)

        this.callbacks.onObservation?.(`工作流执行成功:\n${outputStr.slice(0, 1000)}`)
        return `工作流 "${workflow.name}" 执行成功。结果:\n${outputStr}`
      } else {
        // 更新 SubAgent 状态为错误
        this.callbacks.onToolCallUpdate?.(toolCallId, {
          subAgentProgress: {
            workflowName: workflow.name,
            workflowPath: workflow.workspacePath,
            status: 'error',
            startedAt: Date.now(),
            updatedAt: Date.now(),
          },
        })

        // 更新状态为错误
        this.callbacks.onWorkflowUpdate?.(callIndex, {
          status: 'error',
          error: result.error,
        })

        const errorMsg = result.error || '未知错误'
        this.callbacks.onObservation?.(`工作流执行失败: ${errorMsg}`)
        return `工作流 "${workflow.name}" 执行失败: ${errorMsg}`
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      // 更新工具调用状态为错误
      this.callbacks.onToolCallUpdate?.(toolCallId, {
        subAgentProgress: {
          workflowName: workflow.name,
          workflowPath: workflow.workspacePath,
          status: 'error',
          startedAt: Date.now(),
          updatedAt: Date.now(),
        },
      })

      // 更新状态为错误
      this.callbacks.onWorkflowUpdate?.(callIndex, {
        status: 'error',
        error: errorMsg,
      })

      this.callbacks.onObservation?.(`工作流执行异常: ${errorMsg}`)
      return `工作流 "${workflow.name}" 执行异常: ${errorMsg}`
    }
  }

  /**
   * 压缩消息历史（如果需要）
   * 根据模型配置自动压缩过长的上下文
   * 支持 LLM 驱动的语义压缩
   */
  private async compressMessagesIfNeeded(messages: OpenAIMessage[]): Promise<OpenAIMessage[]> {
    // 获取模型的上下文配置
    const contextConfig = getContextConfig(this.config.model)
    const maxTokens = contextConfig.maxContextTokens - contextConfig.reserveTokens

    // 估算当前 token 数量
    const currentTokens = estimateMessageTokens(messages as unknown as GenericMessage[])

    log(`上下文估算: ${currentTokens} tokens, 最大: ${maxTokens}`)

    // 如果未超过限制，直接返回
    if (currentTokens <= maxTokens) {
      return messages
    }

    // 执行压缩 - 使用异步 LLM 压缩（如果启用）
    log(`触发上下文压缩: ${currentTokens} > ${maxTokens}`)

    // 构建 LLM 压缩选项
    const compressionOptions: HybridCompressionOptions = {
      keepRecentIterations: contextConfig.keepRecentIterations,
      maxObservationLength: contextConfig.maxObservationLength,
      enableSummarization: contextConfig.enableSummarization,
      enableLLMCompression: contextConfig.enableLLMCompression ?? true, // 默认启用 LLM 压缩
      llmOptions: {
        model: this.config.model,
        apiEndpoint: this.config.apiEndpoint || '',
        apiKey: this.config.apiKey,
        provider: this.config.provider,
      },
    }

    try {
      const result = await compressOpenAIContextWithLLM(messages, maxTokens, compressionOptions)

      log(`压缩完成: ${result.originalTokens} -> ${result.newTokens} tokens (${Math.round(result.compressionRatio * 100)}%)`)
      if (result.summary) {
        log(`压缩摘要: ${result.summary}`)
      }

      return result.messages
    } catch (error) {
      // LLM 压缩失败，降级到规则压缩
      log(`LLM 压缩失败，降级到规则压缩: ${error}`)

      const result = compressOpenAIContext(messages, maxTokens, {
        keepRecentIterations: contextConfig.keepRecentIterations,
        maxObservationLength: contextConfig.maxObservationLength,
        enableSummarization: contextConfig.enableSummarization,
      })

      return result.messages
    }
  }
}
