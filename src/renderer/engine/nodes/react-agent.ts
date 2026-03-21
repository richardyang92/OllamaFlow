import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, ReactAgentNodeData, ReActStep } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import type { GeneratedFileInfo } from '@/store/agent-store'
import { interpolateVariables } from '../executor'
import { executeTool, TodosManager, getEnabledTools } from '../tools'
import { useExecutionStore } from '@/store/execution-store'
import { useAgentAnalyticsStore } from '@/store/agent-analytics-store'
import { OpenAIClient, OpenAIMessage, OpenAIChatResponse, parseToolCallArgs } from '../openai-client'
import {
  compressOpenAIContext,
  compressOpenAIContextWithLLM,
  estimateMessageTokens,
  getContextConfig,
  type HybridCompressionOptions
} from '../react-agent/context-compressor'
import { resolveAIConfig } from '../config-resolver'
import {
  validateToolParams,
  formatValidationErrors,
  suggestFix,
  getToolSchema
} from '../react-agent/tool-validator'
import {
  executeToolWithRetry,
  type ToolExecutionResult
} from '../react-agent/retry-handler'

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
    case 'webSearch':
      return {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词或问题' },
          maxResults: { type: 'number', description: '最大返回结果数（可选，默认5，最大10）' },
          engines: {
            type: 'array',
            items: { type: 'string' },
            description: '指定搜索引擎（可选，如 ["google", "bing", "duckduckgo"]）'
          },
          timeRange: {
            type: 'string',
            enum: ['day', 'week', 'month', 'year'],
            description: '时间范围过滤（可选）'
          }
        },
        required: ['query']
      }
    case 'fetchUrl':
      return {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要获取的网页 URL' },
          maxContentLength: { type: 'number', description: '最大内容长度（可选，默认5000字符）' },
          outputFormat: { type: 'string', enum: ['markdown', 'text'], description: '输出格式（可选，默认markdown）' },
          timeout: { type: 'number', description: '超时时间（毫秒，可选，默认30000）' }
        },
        required: ['url']
      }
    default:
      return { type: 'object', properties: {}, required: [] }
  }
}

// Structured tool call history entry
interface StructuredToolCall {
  id: string
  name: string
  argsHash: string
  args: Record<string, unknown>
  result: string
  timestamp: number
  success: boolean
}

// Enhanced loop detection result
interface EnhancedLoopDetection {
  isLoop: boolean
  loopType: 'overPlanning' | 'repeatedAction' | 'semanticDrift' | 'noProgress' | 'taskLikelyComplete' | 'repeatedWriteFile' | 'consecutiveError' | 'repeatedFailedAction' | null
  confidence: number
  suggestion: string | null
  blockedActions: string[]
  similarCalls: Array<{ toolName: string; similarity: number; count: number }>
  progressScore: number
  recentErrors?: Array<{ toolName: string; error: string; iteration: number }>
}

// Default loop detection config
const DEFAULT_LOOP_CONFIG = {
  maxRepeatedActions: 5,
  maxSameToolCalls: 4,
  maxTodosAddCalls: 4,
  maxWriteFileCalls: 4,
  enableSemanticDrift: true,
  progressCheckInterval: 3,
  maxConsecutiveErrors: 3, // 最多允许连续错误次数
  maxSameFailedToolCalls: 3, // 同一工具失败的最大次数
}

function hashArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args, Object.keys(args).sort())
  } catch {
    return '{}'
  }
}

function extractStructuredHistory(messages: OpenAIMessage[]): StructuredToolCall[] {
  const history: StructuredToolCall[] = []
  let callId = 0

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name.toLowerCase()
        const args = parseToolCallArgs(tc.function.arguments)
        const resultMsg = messages.find(
          (m, idx) => idx > i && m.role === 'tool' && m.tool_call_id === tc.id
        )
        const result = resultMsg?.content || ''
        const success = !result.includes('错误:') && !result.includes('失败') && !result.includes('Error')

        history.push({
          id: `call-${callId++}`,
          name: toolName,
          argsHash: hashArgs(args),
          args,
          result,
          timestamp: Date.now(),
          success,
        })
      }
    }
  }

  return history
}

function detectLoop(
  messages: OpenAIMessage[],
  config: typeof DEFAULT_LOOP_CONFIG = DEFAULT_LOOP_CONFIG
): EnhancedLoopDetection {
  const history = extractStructuredHistory(messages)

  if (history.length < 2) {
    return {
      isLoop: false,
      loopType: null,
      confidence: 0,
      suggestion: null,
      blockedActions: [],
      similarCalls: [],
      progressScore: 1,
    }
  }

  const blockedActions: string[] = []
  let loopType: EnhancedLoopDetection['loopType'] = null
  let suggestion: string | null = null
  let confidence = 0
  const similarCalls: EnhancedLoopDetection['similarCalls'] = []

  // 收集最近的错误用于分析
  const recentErrors: Array<{ toolName: string; error: string; iteration: number }> = []
  
  // 检测连续相同错误
  const recentHistory = history.slice(-config.maxConsecutiveErrors * 2)
  let consecutiveErrorCount = 0
  let lastErrorHash = ''
  
  for (let i = recentHistory.length - 1; i >= 0; i--) {
    const call = recentHistory[i]
    if (!call.success) {
      // 提取错误的关键部分（忽略时间戳、路径等变化）
      const errorKey = `${call.name}:${extractErrorSignature(call.result)}`
      
      if (errorKey === lastErrorHash || lastErrorHash === '') {
        consecutiveErrorCount++
        lastErrorHash = errorKey
        recentErrors.push({
          toolName: call.name,
          error: call.result.slice(0, 200),
          iteration: i
        })
      } else {
        break
      }
    } else {
      break
    }
  }

  // 如果检测到连续相同错误，标记为循环
  if (consecutiveErrorCount >= config.maxConsecutiveErrors) {
    const lastCall = history[history.length - 1]
    loopType = 'consecutiveError'
    suggestion = `检测到连续 ${consecutiveErrorCount} 次相同的错误。${lastCall.name} 工具调用持续失败，错误信息：${lastCall.result.slice(0, 100)}。请尝试不同的方法或直接给出最终答案。`
    blockedActions.push(lastCall.name)
    confidence = 0.9
  }

  // 检测同一工具多次失败
  if (!loopType) {
    const failedToolCalls = new Map<string, { count: number; errors: Set<string> }>()
    
    for (const call of history.filter(h => !h.success)) {
      const existing = failedToolCalls.get(call.name) || { count: 0, errors: new Set() }
      existing.count++
      existing.errors.add(extractErrorSignature(call.result))
      failedToolCalls.set(call.name, existing)
    }

    for (const [toolName, info] of failedToolCalls) {
      if (info.count >= config.maxSameFailedToolCalls) {
        loopType = 'repeatedFailedAction'
        suggestion = `工具 ${toolName} 已经连续失败 ${info.count} 次。请检查工具参数是否正确，或尝试使用其他工具/方法。`
        blockedActions.push(toolName)
        confidence = 0.85
        break
      }
    }
  }

  const todosAddCount = history.filter(
    (h) => h.name === 'todos' && h.result.includes('已添加任务')
  ).length

  if (!loopType && todosAddCount > config.maxTodosAddCalls) {
    loopType = 'overPlanning'
    suggestion = '你已经规划了足够的任务，现在必须立即执行实际操作！'
    blockedActions.push('todos')
    confidence = 0.9
  }

  if (!loopType) {
    const execResults = history.filter((h) => h.name === 'executecommand')
    const lastExecResult = execResults.length > 0 ? execResults[execResults.length - 1] : null

    if (lastExecResult) {
      const successKeywords = ['saved', 'created', 'generated', 'success', 'complete', 'done', '完成', '成功', '保存', '生成', 'image saved']
      const hadSuccess = successKeywords.some((kw) =>
        lastExecResult.result.toLowerCase().includes(kw)
      )

      if (hadSuccess) {
        const lastExecIndex = history.indexOf(lastExecResult)
        const writeFileAfter = history.filter(
          (h, idx) => idx > lastExecIndex && h.name === 'writefile'
        ).length

        if (writeFileAfter > 0) {
          loopType = 'taskLikelyComplete'
          suggestion = '之前的命令执行已成功！请直接给出最终答案。'
          blockedActions.push('writefile')
          confidence = 0.85
        }
      }
    }
  }

  if (!loopType) {
    const writeFileCount = history.filter((h) => h.name === 'writefile').length

    if (writeFileCount >= config.maxWriteFileCalls) {
      loopType = 'repeatedWriteFile'
      suggestion = `你已经写入了 ${writeFileCount} 次文件。现在必须执行脚本或给出最终答案！`
      blockedActions.push('writefile')
      confidence = 0.85
    }
  }

  if (!loopType && config.enableSemanticDrift) {
    const recentHistory10 = history.slice(-10)
    const toolCounts = new Map<string, { count: number; argsHashes: Set<string> }>()

    for (const call of recentHistory10) {
      const existing = toolCounts.get(call.name) || { count: 0, argsHashes: new Set() }
      existing.count++
      existing.argsHashes.add(call.argsHash)
      toolCounts.set(call.name, existing)
    }

    for (const [toolName, info] of toolCounts) {
      if (info.count >= config.maxRepeatedActions) {
        loopType = 'repeatedAction'
        suggestion = `你已经连续 ${info.count} 次执行 ${toolName}。请使用不同的工具或给出最终答案。`
        blockedActions.push(toolName)
        confidence = 0.8
        similarCalls.push({ toolName, similarity: 1, count: info.count })
        break
      }

      if (info.count >= 3 && info.argsHashes.size === 1) {
        loopType = 'semanticDrift'
        suggestion = `检测到 ${toolName} 工具被重复调用 ${info.count} 次且参数相同。请尝试不同的方法。`
        blockedActions.push(toolName)
        confidence = 0.75
        similarCalls.push({ toolName, similarity: 1, count: info.count })
        break
      }
    }
  }

  if (!loopType) {
    const todosCalls = history.filter((h) => h.name === 'todos')
    const hasProgress = todosCalls.some(
      (h) => h.result.includes('已完成') || h.result.includes('complete')
    )
    const addOnlyCalls = todosCalls.filter((h) =>
      h.result.includes('已添加任务')
    ).length

    if (addOnlyCalls >= config.progressCheckInterval && !hasProgress) {
      loopType = 'noProgress'
      suggestion = '你一直在添加任务但没有完成任何任务。请开始执行任务！'
      blockedActions.push('todos')
      confidence = 0.7
    }
  }

  let progressScore = 1
  if (loopType) {
    progressScore = Math.max(0, 1 - confidence * 0.5)
  }

  return {
    isLoop: loopType !== null,
    loopType,
    confidence,
    suggestion,
    blockedActions,
    similarCalls,
    progressScore,
    recentErrors: recentErrors.slice(0, 3),
  }
}

// 提取错误签名用于比较（忽略变化的部分如时间戳、临时ID等）
function extractErrorSignature(errorMessage: string): string {
  // 移除数字、UUID、路径等变化的内容
  return errorMessage
    .toLowerCase()
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, 'UUID')
    .replace(/\b\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\b/g, 'TIMESTAMP')
    .replace(/[0-9a-f]{32,}/gi, 'HASH')
    .replace(/\/[^\s:]+\/[\w\/\.-]+/g, '/PATH')
    .replace(/\\[^\s:]+\\[\w\\\.]+/g, '\\PATH')
    .replace(/\d+/g, 'N')
    .slice(0, 200)
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

// Build full system prompt with current date/time
function buildFullSystemPrompt(systemPrompt: string, enableUserInput: boolean): string {
  const now = new Date()
  const currentDate = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
  const currentTime = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })

  return `${systemPrompt}

## 📅 当前时间
今天是 ${currentDate}，当前时间 ${currentTime}。
在处理涉及时间、日期的任务时，请以这个时间为准。

## 你的能力
你是一个高效的 ReAct 智能体，遵循"思考-行动-观察"循环来解决问题。
你可以调用工具来执行实际操作，不要只靠想象给出答案。

## ⚡ 核心效率原则（最重要）

1. **规划先行**: 接到任务后，建议先用 todos 工具规划步骤（使用 init 一次性创建）
2. **适时早停**: 确信任务完成时立即给出最终答案，不要反复验证
3. **一次性完成**: 写代码时要完整，避免多次修改；执行成功后直接回答

## 可用工具

**⚠️ 调用工具时的重要提示**:
- 所有工具参数都必须严格按 JSON 格式提供
- 必填参数不能省略，否则工具调用会失败
- 调用前请确认已包含所有必需的参数

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

### writeFile - 写入文件（重要：必须同时提供 filename 和 content 参数！）
输入: {"filename": "output.py", "content": "print('hello')"}

### writeMultipleFiles - 批量写入
一次写入多个文件: {"files": [{"filename": "a.py", "content": "..."}, {"filename": "b.py", "content": "..."}]}

### httpRequest - HTTP请求
输入: {"url": "https://api.example.com", "method": "GET"}

### fetchUrl - 获取网页内容
获取并解析网页，返回干净的 Markdown 格式内容（自动过滤广告和导航）
输入: {"url": "https://example.com", "maxContentLength": 5000}

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

## 🛡️ 错误处理指南（重要）

### 工具调用失败时的应对策略：

1. **参数错误**（文件不存在、路径错误等）：
   - 检查参数是否正确
   - 尝试使用其他路径或方法
   - 不要重复相同的错误调用超过2次

2. **连续相同错误检测**：
   - 系统会自动检测连续相同的错误
   - 如果同一工具连续失败3次，会被临时阻止
   - 被阻止后应尝试：
     - 使用替代工具或方法
     - 检查当前任务状态是否已完成
     - 根据已有信息给出最佳答案

3. **循环行为预防**：
   - 避免过度规划（不要反复添加任务而不执行）
   - 避免重复写入相同内容的文件
   - 任务明确完成后，直接给出答案，不要反复验证

4. **明智的终止**：
   - 如果尝试了多种方法仍失败，根据已有信息给出最佳答案
   - 不要陷入无限重试相同失败的工具

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
  // Build comprehensive steps summary - include all completed steps with FULL observation content
  const keyStepsSummary = steps
    .filter(s => s.action && s.observation)
    .map(s => {
      const observation = s.observation || ''
      // 不截断观察结果，保留完整内容，不包含思考过程
      return `## 步骤 ${s.iteration}: ${s.action}\n结果: ${observation}`
    })
    .join('\n\n')

  // Extract key observations that might contain important results (full content)
  const keyObservations = steps
    .filter(s => s.observation && !s.observation.includes('错误') && !s.observation.includes('失败'))
    .map(s => s.observation)
    .slice(-3) // 最后3个成功的观察结果
    .join('\n---\n')

  const summaryMessages: OpenAIMessage[] = [
    messages[0], // System prompt
    {
      role: 'user',
      content: `任务执行已完成，请根据以下执行记录，用中文给用户一个完整、有价值的总结回复。

## 用户的原始问题
${messages[1]?.content || '（未知）'}

## 完整执行记录
${keyStepsSummary || '（无执行记录）'}

## 关键结果摘录
${keyObservations || '（无关键结果）'}

## 总结要求
1. 直接回答用户的问题，不要说"根据执行记录"
2. 必须包含具体的数值、文件名、路径等所有关键信息，不要遗漏
3. 如果生成了文件，明确说明文件位置
4. 如果有数据或结果，完整展示具体内容，不要省略
5. 回答要完整详尽，确保用户能获得所有需要的信息`
    }
  ]

  try {
    const response = await client.chat({
      model,
      messages: summaryMessages,
      temperature: 0.3,
      max_tokens: 4000, // 大幅增加 token 限制以保留完整信息
    })
    return response.content || `任务已完成 ${todosStatus.completed} 个步骤。`
  } catch (error) {
    console.error('[ReAct] Failed to generate summary:', error)
    // 降级：直接返回最后一个成功的观察结果
    const lastSuccessObs = steps.filter(s => s.observation && !s.observation.includes('错误')).pop()?.observation
    return lastSuccessObs || `任务已完成 ${todosStatus.completed} 个步骤。`
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

  // Initialize analytics
  const executionId = `exec-${node.id}-${Date.now()}`
  const analyticsStore = useAgentAnalyticsStore.getState()
  analyticsStore.initExecution(node.id, executionId, userMessage, maxIterations)
  const thinkingStartTimeRef: Record<string, number> = {}

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

      // 构建 LLM 压缩选项
      const compressionOptions: HybridCompressionOptions = {
        keepRecentIterations: contextConfig.keepRecentIterations,
        maxObservationLength: contextConfig.maxObservationLength,
        enableSummarization: contextConfig.enableSummarization,
        enableLLMCompression: contextConfig.enableLLMCompression ?? true,
        llmOptions: {
          model: data.model,
          apiEndpoint: apiEndpoint,
          apiKey: apiKey,
          // 根据 apiEndpoint 判断 provider
          provider: apiEndpoint.includes('11434') ? 'ollama' : 'openai',
        },
      }

      try {
        // 尝试 LLM 压缩
        const compressionResult = await compressOpenAIContextWithLLM(messages, maxContextTokens, compressionOptions)

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
      } catch (error) {
        // LLM 压缩失败，降级到规则压缩
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'warn',
          message: `LLM 压缩失败，使用规则压缩: ${error instanceof Error ? error.message : String(error)}`,
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
      maxIterations,
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
    
    // Track thinking start
    thinkingStartTimeRef[stepId] = Date.now()
    analyticsStore.updateMetrics({
      nodeId: node.id,
      executionId,
      type: 'thinking_start',
      timestamp: Date.now(),
      data: { startTime: Date.now(), iteration }
    })

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
            } else if (toolName === 'writeFile') {
              const errorResult = {
                toolCallId: toolCall.id,
                toolName,
                success: false,
                observation: `错误: 调用 writeFile 工具时未提供参数。必须提供 filename 和 content 参数。例如: {"filename": "output.txt", "content": "文件内容"}`,
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
          
          // Track tool call start
          analyticsStore.updateMetrics({
            nodeId: node.id,
            executionId,
            type: 'tool_start',
            timestamp: Date.now(),
            data: {
              toolId: toolCall.id,
              toolName
            }
          })

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
            // 增强被阻止操作的反馈信息
            const blockedReason = loopInfo.loopType === 'consecutiveError' 
              ? '检测到连续相同错误'
              : loopInfo.loopType === 'repeatedFailedAction'
              ? '工具多次失败'
              : loopInfo.loopType === 'overPlanning'
              ? '过度规划'
              : loopInfo.loopType === 'repeatedAction'
              ? '重复操作'
              : '循环行为'
            
            const blockedObservation = `🚫 操作被阻止 [${blockedReason}]: ${loopInfo.suggestion || '此操作已被阻止'}

⚠️ 检测到潜在的循环行为，系统已阻止继续执行 ${toolName}。
建议:
1. 尝试使用不同的工具或方法
2. 检查任务状态，可能已经完成
3. 如有必要，直接给出当前已知的最佳答案
4. 如果是配置问题，请检查工具参数是否正确`
            
            // 记录到日志
            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'warn',
              message: `循环检测: ${toolName} 被阻止 (${blockedReason}) - ${loopInfo.suggestion}`,
            })
            
            result = {
              toolCallId: toolCall.id,
              toolName,
              success: false,
              observation: blockedObservation,
            }
          } else {
            const schema = getToolSchema(toolName)
            if (schema) {
              const validationResult = validateToolParams(toolName, toolArgs, schema)
              if (!validationResult.valid) {
                const errorDetails = formatValidationErrors(validationResult)
                const suggestion = suggestFix(toolName, toolArgs, validationResult)
                result = {
                  toolCallId: toolCall.id,
                  toolName,
                  success: false,
                  observation: `参数验证失败:\n${errorDetails}${suggestion ? `\n建议: ${suggestion}` : ''}`,
                }
                allResults.push(result)
                groupObservations.push(result.observation)
                return
              }
              if (validationResult.warnings.length > 0) {
                context.onLog?.({
                  nodeId: node.id,
                  nodeName: data.label,
                  level: 'warn',
                  message: `工具参数警告: ${validationResult.warnings.map(w => w.message).join('; ')}`,
                })
              }
            }

            if (data.stream) {
              context.onStream?.(node.id, `🔧 调用: ${toolName}\n`)
            }

            try {
              const toolResult = await executeToolWithRetry(
                async () => {
                  const res = await executeTool(tool, toolArgs, context, todosManager)
                  return {
                    success: res.success,
                    result: res.success ? res.output : res.error || '未知错误',
                    error: res.success ? undefined : res.error
                  }
                },
                toolName,
                { maxRetries: 2 },
                (attempt, error, delay) => {
                  context.onLog?.({
                    nodeId: node.id,
                    nodeName: data.label,
                    level: 'warn',
                    message: `工具 ${toolName} 执行${error ? '失败' : '未成功'}，${delay}ms 后重试 (第 ${attempt} 次)...`,
                  })
                }
              )
              
              let observation = toolResult.success ? toolResult.result : `错误: ${toolResult.error || toolResult.result}`

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
               
               // Track tool call end
               analyticsStore.updateMetrics({
                 nodeId: node.id,
                 executionId,
                 type: 'tool_end',
                 timestamp: Date.now(),
                 data: {
                   toolId: toolCall.id,
                   success: toolResult.success
                 }
               })
             } catch (error) {
               result = {
                 toolCallId: toolCall.id,
                 toolName,
                 success: false,
                 observation: `工具执行错误: ${(error as Error).message}`,
               }
               
               // Track tool call error
               analyticsStore.updateMetrics({
                 nodeId: node.id,
                 executionId,
                 type: 'tool_end',
                 timestamp: Date.now(),
                 data: {
                   toolId: toolCall.id,
                   success: false
                 }
               })
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
      
      // Track thinking end and iteration complete
      const thinkingStartTime = thinkingStartTimeRef[stepId]
      if (thinkingStartTime) {
        analyticsStore.updateMetrics({
          nodeId: node.id,
          executionId,
          type: 'thinking_end',
          timestamp: Date.now(),
          data: {
            startTime: thinkingStartTime,
            thought: content || reasoningContent || '',
            iteration
          }
        })
      }
      
      analyticsStore.updateMetrics({
        nodeId: node.id,
        executionId,
        type: 'iteration_complete',
        timestamp: Date.now(),
        data: { iteration }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'error',
        message: `API 请求失败: ${errorMessage}`,
      })
      
      // Mark execution as failed
      analyticsStore.completeExecution(node.id, false)
      
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
  
  // Mark execution as complete
  analyticsStore.updateMetrics({
    nodeId: node.id,
    executionId,
    type: 'execution_complete',
    timestamp: Date.now(),
    data: {}
  })
  analyticsStore.completeExecution(node.id, true)

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

    // 添加循环检测
    const loopInfo = detectLoop(messages)
    if (loopInfo.isLoop) {
      context.onLog?.({
        nodeId,
        nodeName: nodeData.label,
        level: 'warn',
        message: `用户输入处理中检测到循环: ${loopInfo.loopType} - ${loopInfo.suggestion}`,
      })

      // 如果检测到严重循环，直接返回最终答案
      if (loopInfo.confidence >= 0.8) {
        finalAnswer = `任务执行过程中遇到问题: ${loopInfo.suggestion}。基于已执行的操作，当前任务状态: ${todosManager.getStatus().completed}/${todosManager.getStatus().total} 任务已完成。`
        executionStore.setReActFinalAnswer(context.executionId, nodeId, finalAnswer)
        break
      }
    }

    iteration++
    const stepId = `step-${iteration}-${Date.now()}`
    const newStep: ReActStep = {
      id: stepId,
      iteration,
      maxIterations,
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

    // 在每次工具调用前重新检测循环
    const currentLoopInfo = detectLoop(messages)
    
    for (const toolCall of response.tool_calls) {
      const toolName = toolCall.function.name
      const toolArgs = parseToolCallArgs(toolCall.function.arguments)
      const tool = allTools.find(t => t.name === toolName)

      if (!tool) continue

      // 检查是否被循环检测阻止
      if (currentLoopInfo.blockedActions.includes(toolName.toLowerCase())) {
        const blockedObservation = `🚫 操作被阻止: ${currentLoopInfo.suggestion || '此操作已被阻止'}

建议:
1. 尝试使用不同的工具或方法
2. 检查任务状态，可能已经完成
3. 根据已有信息给出最佳答案`
        
        context.onLog?.({
          nodeId,
          nodeName: nodeData.label,
          level: 'warn',
          message: `循环检测: ${toolName} 被阻止 - ${currentLoopInfo.suggestion}`,
        })
        
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: blockedObservation })
        
        executionStore.updateReActStep(context.executionId, nodeId, {
          id: stepId,
          status: 'observing',
          observation: blockedObservation,
          observationError: true,
        })
        continue
      }

      executionStore.updateReActStep(context.executionId, nodeId, {
        id: stepId,
        status: 'acting',
        action: toolName,
        actionInput: JSON.stringify(toolArgs),
      })

      // 使用重试机制执行工具
      let toolExecutionResult: ToolExecutionResult
      try {
        toolExecutionResult = await executeToolWithRetry(
          async () => {
            const res = await executeTool(tool, toolArgs, context, todosManager)
            return {
              success: res.success,
              result: res.success ? res.output : res.error || '未知错误',
              error: res.success ? undefined : res.error
            }
          },
          toolName,
          { maxRetries: 2 },
          (attempt, error, delay) => {
            context.onLog?.({
              nodeId,
              nodeName: nodeData.label,
              level: 'warn',
              message: `工具 ${toolName} 执行${error ? '失败' : '未成功'}，${delay}ms 后重试 (第 ${attempt} 次)...`,
            })
          }
        )
      } catch {
        toolExecutionResult = { success: false, result: '', error: `工具 ${toolName} 执行失败` }
      }
      
      const observation = toolExecutionResult.success 
        ? toolExecutionResult.result 
        : `错误: ${toolExecutionResult.error || toolExecutionResult.result}`

      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: observation })

      executionStore.updateReActStep(context.executionId, nodeId, {
        id: stepId,
        status: 'observing',
        observation,
        observationError: !toolExecutionResult.success,
      })
    }
    
    executionStore.completeReActStep(context.executionId, nodeId, stepId)
  }

  if (!finalAnswer) {
    finalAnswer = `在 ${maxIterations} 次迭代后未能得出最终答案。`
  }

  return {
    response: finalAnswer,
  }
}
