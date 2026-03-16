import type { ToolDefinition, TodoItem, TodosAction, AvailableToolId } from '@/types/node'
import { AVAILABLE_TOOLS as availableTools } from '@/types/node'
import type { ExecutionContext } from '../executor'
import { mathCalculate, mathStatistics } from './math'
import { mathNumberTheory } from './math-number'
import { mathLinearAlgebra } from './math-linear'
import { mathUnitConvert } from './math-unit'
import { mathProbability } from './math-probability'
import { mathCalculus } from './math-calculus'
import { mathEquation } from './math-equation'

// Tool execution result
export interface ToolResult {
  success: boolean
  output: string
  error?: string
}

// 根据工具 ID 获取完整的工具定义
export function getToolById(toolId: AvailableToolId): ToolDefinition | undefined {
  const tool = availableTools.find((t) => t.id === toolId)
  if (!tool) return undefined
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    type: tool.type,
    config: {},
  }
}

// 获取所有启用的工具定义（始终包含内置的 todos 和 getCurrentDate 工具）
export function getEnabledTools(enabledToolIds: AvailableToolId[]): ToolDefinition[] {
  // 始终包含内置工具
  const todosTool = getToolById('todos')
  const getCurrentDateTool = getToolById('getCurrentDate')
  const userTools = enabledToolIds
    .filter((id) => id !== 'todos' && id !== 'getCurrentDate') // 排除内置工具，稍后统一添加
    .map((id) => getToolById(id))
    .filter((t): t is ToolDefinition => t !== undefined)

  const builtInTools: ToolDefinition[] = []
  if (todosTool) builtInTools.push(todosTool)
  if (getCurrentDateTool) builtInTools.push(getCurrentDateTool)

  return [...builtInTools, ...userTools]
}

// Todos Manager class for managing task lists
export class TodosManager {
  private todos: TodoItem[] = []

  execute(action: TodosAction, content?: string, taskId?: string, tasks?: string[]): ToolResult {
    switch (action) {
      case 'init': {
        // Initialize task list with multiple tasks at once
        let taskList: string[] = []
        if (tasks && Array.isArray(tasks)) {
          taskList = tasks.filter(t => typeof t === 'string' && t.trim())
        } else if (content) {
          // Fallback: try to parse content as JSON array
          try {
            const parsed = JSON.parse(content)
            if (Array.isArray(parsed)) {
              taskList = parsed.filter((t: unknown) => typeof t === 'string' && String(t).trim())
            } else {
              taskList = [content]
            }
          } catch {
            taskList = [content]
          }
        }

        // Clear existing and add all tasks using immutable pattern
        const now = Date.now()
        this.todos = taskList.map((task, i) => ({
          id: `todo-${now + i}`,
          content: task.trim(),
          completed: false,
          createdAt: now + i,
        }))

        if (this.todos.length === 0) {
          return { success: false, output: '', error: '未提供有效的任务列表' }
        }

        const listOutput = this.todos.map((t, i) => `${i + 1}. ${t.content}`).join('\n')
        return {
          success: true,
          output: `已创建 ${this.todos.length} 个任务:\n${listOutput}`,
        }
      }

      case 'add': {
        // Add new task
        const newTodo: TodoItem = {
          id: `todo-${Date.now()}`,
          content: content || '',
          completed: false,
          createdAt: Date.now(),
        }
        this.todos = [...this.todos, newTodo]
        return {
          success: true,
          output: `已添加任务: "${newTodo.content}" (ID: ${newTodo.id})`,
        }
      }

      case 'complete': {
        // Mark task as completed
        const index = this.todos.findIndex(
          (t) => t.id === taskId || (content && t.content.includes(content))
        )
        if (index !== -1) {
          // Create a new array with the updated item to avoid issues with frozen objects
          this.todos = [
            ...this.todos.slice(0, index),
            { ...this.todos[index], completed: true },
            ...this.todos.slice(index + 1),
          ]
          return {
            success: true,
            output: `已完成任务: "${this.todos[index].content}"`,
          }
        }
        return { success: false, output: '', error: '未找到指定任务' }
      }

      case 'list': {
        // List all tasks
        if (this.todos.length === 0) {
          return {
            success: true,
            output: '待办事项: (无任务)\n\n共 0 个任务，已完成 0 个',
          }
        }
        const todoList = this.todos
          .map((t, i) => `${i + 1}. [${t.completed ? 'x' : ' '}] ${t.content}`)
          .join('\n')
        const summary = `共 ${this.todos.length} 个任务，已完成 ${this.todos.filter((t) => t.completed).length} 个`
        return {
          success: true,
          output: `待办事项:\n${todoList}\n\n${summary}`,
        }
      }

      case 'remove': {
        // Remove task
        const index = this.todos.findIndex(
          (t) => t.id === taskId || (content && t.content.includes(content))
        )
        if (index !== -1) {
          const removed = this.todos[index]
          this.todos = [...this.todos.slice(0, index), ...this.todos.slice(index + 1)]
          return { success: true, output: `已删除任务: "${removed.content}"` }
        }
        return { success: false, output: '', error: '未找到指定任务' }
      }

      case 'clear': {
        // Clear all tasks
        const count = this.todos.length
        this.todos = []
        return { success: true, output: `已清空 ${count} 个任务` }
      }

      default:
        return { success: false, output: '', error: `未知操作: ${action}` }
    }
  }

  getStatus(): { total: number; completed: number; pending: number; items: TodoItem[] } {
    return {
      total: this.todos.length,
      completed: this.todos.filter((t) => t.completed).length,
      pending: this.todos.filter((t) => !t.completed).length,
      items: this.todos,
    }
  }
}

// Parse todos action input
function parseTodosInput(
  actionInput: string | Record<string, unknown>
): { action: TodosAction; content?: string; taskId?: string; tasks?: string[] } | null {
  let parsed: Record<string, unknown>

  // Handle both string and object input
  if (typeof actionInput === 'object') {
    parsed = actionInput
  } else {
    try {
      parsed = JSON.parse(actionInput)
    } catch {
      // Try to parse simple format
      const parts = actionInput.split(',').map((p) => p.trim())
      if (parts.length >= 1 && parts[0]) {
        return {
          action: parts[0] as TodosAction,
          content: parts.slice(1).join(','),
        }
      }
      return null
    }
  }

  // Validate action is present and valid
  const action = parsed.action as TodosAction | undefined
  if (!action) {
    return null
  }

  // Validate action is one of the allowed values
  const validActions: TodosAction[] = ['init', 'add', 'complete', 'list', 'remove', 'clear']
  if (!validActions.includes(action)) {
    return null
  }

  return {
    action,
    content: parsed.content as string | undefined,
    taskId: parsed.taskId as string | undefined,
    tasks: parsed.tasks as string[] | undefined,
  }
}

// Execute read file tool
async function executeReadFile(
  actionInput: string | Record<string, unknown>,
  workspacePath: string
): Promise<ToolResult> {
  try {
    // Parse filePath from input (can be string or object)
    let filePath: string
    if (typeof actionInput === 'object') {
      filePath = (actionInput.filePath as string) || ''
    } else {
      // Try to parse as JSON first, then use as raw path
      try {
        const parsed = JSON.parse(actionInput)
        filePath = (parsed.filePath as string) || actionInput
      } catch {
        filePath = actionInput
      }
    }

    const result = await window.electronAPI.file.read(workspacePath, filePath)
    if (!result.success) {
      return { success: false, output: '', error: result.error || '读取文件失败' }
    }
    return { success: true, output: result.content || '' }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `读取文件错误: ${(error as Error).message}`,
    }
  }
}

// Execute write file tool
async function executeWriteFile(
  config: Record<string, unknown>,
  actionInput: string | Record<string, unknown>,
  workspacePath: string
): Promise<ToolResult> {
  try {
    // Parse the input to extract filename and content
    let filePath: string
    let fileContent: string

    if (typeof actionInput === 'object') {
      // Direct object input from function calling
      filePath = (actionInput.filename as string) || (actionInput.filePath as string) || 'output.txt'
      fileContent = (actionInput.content as string) || ''
    } else {
      // String input - try to parse as JSON
      try {
        const parsed = JSON.parse(actionInput)
        filePath = parsed.filename || parsed.filePath || 'output.txt'
        fileContent = parsed.content || ''
      } catch {
        // Try to extract filename from partial JSON or use input as content
        // First, try to find filename pattern in the input
        const filenameMatch = actionInput.match(/"filename"\s*:\s*"([^"]+)"/)
        const filePathMatch = actionInput.match(/"filePath"\s*:\s*"([^"]+)"/)

        if (filenameMatch) {
          filePath = filenameMatch[1]
          // Try to extract content using regex as well
          const contentMatch = actionInput.match(/"content"\s*:\s*"([\s\S]*?)"(?:\s*}|\s*,)/)
          fileContent = contentMatch ? contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : actionInput
        } else if (filePathMatch) {
          filePath = filePathMatch[1]
          const contentMatch = actionInput.match(/"content"\s*:\s*"([\s\S]*?)"(?:\s*}|\s*,)/)
          fileContent = contentMatch ? contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : actionInput
        } else {
          // If not valid JSON and no filename found, use the input as content with default filename
          filePath = (config.filePath as string) || 'output.txt'
          fileContent = actionInput
        }
      }
    }

    const result = await window.electronAPI.file.write(workspacePath, filePath, fileContent)
    if (!result.success) {
      return { success: false, output: '', error: result.error || '写入文件失败' }
    }
    return { success: true, output: `文件已写入: ${filePath}` }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `写入文件错误: ${(error as Error).message}`,
    }
  }
}

// Execute shell command tool
async function executeShellCommand(
  actionInput: string | Record<string, unknown>,
  workspacePath: string,
  config: Record<string, unknown>
): Promise<ToolResult> {
  try {
    // Parse command from input (can be string or object)
    let command: string
    if (typeof actionInput === 'object') {
      command = (actionInput.command as string) || ''
    } else {
      // Try to parse as JSON first, then use as raw command
      try {
        const parsed = JSON.parse(actionInput)
        command = (parsed.command as string) || actionInput
      } catch {
        command = actionInput
      }
    }

    const timeout = (config.timeout as number) || 30000
    const cwd = (config.cwd as string) || ''
    const result = await window.electronAPI.command.execute(workspacePath, {
      command,
      cwd,
      timeout,
    })
    if (!result.success) {
      return {
        success: false,
        output: result.stdout || '',
        error: `命令失败 (退出码: ${result.exitCode}): ${result.stderr}`,
      }
    }
    return { success: true, output: result.stdout || '' }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `执行命令错误: ${(error as Error).message}`,
    }
  }
}

// Execute get current date tool
function executeGetCurrentDate(
  actionInput?: string | Record<string, unknown>
): ToolResult {
  try {
    // Parse format from input
    let format = 'full'
    if (actionInput) {
      if (typeof actionInput === 'object') {
        format = (actionInput.format as string) || 'full'
      } else {
        try {
          const parsed = JSON.parse(actionInput)
          format = (parsed.format as string) || 'full'
        } catch {
          // Use default format
        }
      }
    }

    const now = new Date()

    switch (format) {
      case 'date': {
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        return { success: true, output: `${year}-${month}-${day}` }
      }
      case 'time': {
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')
        const seconds = String(now.getSeconds()).padStart(2, '0')
        return { success: true, output: `${hours}:${minutes}:${seconds}` }
      }
      case 'timestamp': {
        return { success: true, output: String(Math.floor(now.getTime() / 1000)) }
      }
      case 'full':
      default: {
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')
        const seconds = String(now.getSeconds()).padStart(2, '0')
        const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
        return {
          success: true,
          output: `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${weekDay}`,
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `获取日期错误: ${(error as Error).message}`,
    }
  }
}

// Execute HTTP request tool
async function executeHttpRequest(
  actionInput: string | Record<string, unknown>,
  config: Record<string, unknown>
): Promise<ToolResult> {
  try {
    // Parse URL from input (can be string or object)
    let url: string
    let method = (config.method as string) || 'GET'
    let headers = (config.headers as Record<string, string>) || {}
    let body = config.body as string | undefined
    let parseContent = config.parseContent !== false // Default true
    let maxContentLength = (config.maxContentLength as number) || 5000

    if (typeof actionInput === 'object') {
      url = (actionInput.url as string) || ''
      // Allow override from actionInput
      if (actionInput.method) method = actionInput.method as string
      if (actionInput.headers) headers = { ...headers, ...(actionInput.headers as Record<string, string>) }
      if (actionInput.body) body = actionInput.body as string
      if (actionInput.parseContent !== undefined) parseContent = actionInput.parseContent as boolean
    } else {
      // Try to parse as JSON first, then use as raw URL
      try {
        const parsed = JSON.parse(actionInput)
        url = (parsed.url as string) || actionInput
        if (parsed.method) method = parsed.method
        if (parsed.headers) headers = { ...headers, ...parsed.headers }
        if (parsed.body) body = parsed.body
      } catch {
        url = actionInput
      }
    }

    const timeout = (config.timeout as number) || 30000

    // Use IPC to make HTTP request from main process
    const result = await window.electronAPI.http.fetch({
      url,
      method,
      headers,
      body,
      timeout,
    })

    if (result.error) {
      return {
        success: false,
        output: '',
        error: `HTTP 请求错误: ${result.error}`,
      }
    }

    // Check if we should parse HTML content
    if (parseContent && result.body) {
      const isHtml = await window.electronAPI.webParser.isHtml(result.body)
      if (isHtml) {
        const parsed = await window.electronAPI.webParser.parseHtml(result.body, url, {
          maxContentLength,
          includeLinks: true,
          outputFormat: 'markdown',
        })

        if (parsed.error) {
          // Parsing failed, return truncated raw content
          return {
            success: result.success,
            output: result.body.length > maxContentLength
              ? result.body.slice(0, maxContentLength) + '\n...[内容已截断]'
              : result.body,
            error: result.success ? undefined : `HTTP ${result.status}: ${result.statusText}`,
          }
        }

        // Format parsed content for LLM
        const formattedContent = formatParsedContent(parsed, maxContentLength)
        return {
          success: result.success,
          output: formattedContent,
          error: result.success ? undefined : `HTTP ${result.status}: ${result.statusText}`,
        }
      }
    }

    return {
      success: result.success,
      output: result.body.length > maxContentLength && parseContent
        ? result.body.slice(0, maxContentLength) + '\n...[内容已截断]'
        : result.body,
      error: result.success
        ? undefined
        : `HTTP ${result.status}: ${result.statusText}`,
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `HTTP 请求错误: ${(error as Error).message}`,
    }
  }
}

// Helper to format parsed content
function formatParsedContent(
  parsed: { title: string; mainContent: string; textContent: string; links: Array<{ text: string; href: string }> },
  maxLength: number
): string {
  const parts: string[] = []

  // Add title
  if (parsed.title) {
    parts.push(`# ${parsed.title}\n`)
  }

  // Add main content (truncated if needed)
  let content = parsed.mainContent || parsed.textContent
  if (content.length > maxLength) {
    content = content.slice(0, maxLength) + '\n...[内容已截断]'
  }
  parts.push(content)

  // Add links summary if available
  if (parsed.links && parsed.links.length > 0) {
    parts.push('\n\n## 相关链接')
    parsed.links.slice(0, 10).forEach(link => {
      parts.push(`- [${link.text}](${link.href})`)
    })
    if (parsed.links.length > 10) {
      parts.push(`- ...还有 ${parsed.links.length - 10} 个链接`)
    }
  }

  return parts.join('\n')
}

// Execute browser tool
async function executeBrowserTool(
  toolType: string,
  actionInput: string | Record<string, unknown>,
  workspacePath: string
): Promise<ToolResult> {
  try {
    // Ensure browser is initialized
    const status = await window.electronAPI.browser.getStatus(workspacePath)
    if (!status.isConnected) {
      await window.electronAPI.browser.init(workspacePath, { headless: true })
    }

    // Parse input
    const input = typeof actionInput === 'object' ? actionInput : (() => {
      try {
        return JSON.parse(actionInput)
      } catch {
        return {}
      }
    })()

    switch (toolType) {
      case 'browser_navigate': {
        const result = await window.electronAPI.browser.navigate(workspacePath, input.url as string)
        return {
          success: result.success,
          output: result.success
            ? `已导航到: ${result.url}\n页面标题: ${result.title}`
            : '',
          error: result.error,
        }
      }

      case 'browser_click': {
        const result = await window.electronAPI.browser.click(
          workspacePath,
          input.selector as string,
          { clickCount: input.clickCount as number }
        )
        return {
          success: result.success,
          output: result.message,
          error: result.error,
        }
      }

      case 'browser_type': {
        const result = await window.electronAPI.browser.type(
          workspacePath,
          input.selector as string,
          input.text as string,
          { clear: input.clear as boolean }
        )
        return {
          success: result.success,
          output: result.message,
          error: result.error,
        }
      }

      case 'browser_scroll': {
        const result = await window.electronAPI.browser.scroll(workspacePath, {
          direction: (input.direction as 'up' | 'down') || 'down',
          amount: input.amount as number,
        })
        return {
          success: result.success,
          output: result.message,
          error: result.error,
        }
      }

      case 'browser_screenshot': {
        const result = await window.electronAPI.browser.screenshot(workspacePath, {
          fullPage: input.fullPage as boolean,
          selector: input.selector as string,
        })
        return {
          success: result.success,
          output: result.success
            ? `截图成功 (${result.width}x${result.height})`
            : '',
          error: result.error,
        }
      }

      case 'browser_getContent': {
        const result = await window.electronAPI.browser.getContent(workspacePath, {
          format: (input.format as 'text' | 'html') || 'text',
          selector: input.selector as string,
          maxLength: input.maxLength as number,
          trim: true,
        })
        return {
          success: result.success,
          output: result.success ? result.content : '',
          error: result.success ? undefined : result.error,
        }
      }

      case 'browser_evaluate': {
        const result = await window.electronAPI.browser.evaluate(workspacePath, input.script as string)
        return {
          success: result.success,
          output: result.success
            ? (typeof result.result === 'object'
              ? JSON.stringify(result.result, null, 2)
              : String(result.result))
            : '',
          error: result.error,
        }
      }

      case 'browser_wait': {
        const result = await window.electronAPI.browser.waitForSelector(
          workspacePath,
          input.selector as string,
          { timeout: input.timeout as number }
        )
        return {
          success: result.success,
          output: result.message,
          error: result.error,
        }
      }

      default:
        return { success: false, output: '', error: `未知浏览器工具: ${toolType}` }
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `浏览器工具执行错误: ${(error as Error).message}`,
    }
  }
}

// Execute write multiple files tool
async function executeWriteMultipleFiles(
  actionInput: string | Record<string, unknown>,
  workspacePath: string
): Promise<ToolResult> {
  try {
    // Parse files array from input
    let files: Array<{ filename: string; content: string }> = []

    if (typeof actionInput === 'object' && 'files' in actionInput) {
      files = (actionInput.files as Array<{ filename: string; content: string }>) || []
    } else if (typeof actionInput === 'string') {
      const parsed = JSON.parse(actionInput)
      files = parsed.files || []
    }

    if (!Array.isArray(files) || files.length === 0) {
      return { success: false, output: '', error: '未提供有效的文件列表' }
    }

    const results: string[] = []
    let successCount = 0

    for (const file of files) {
      const filePath = file.filename || (file as Record<string, unknown>).filePath as string
      const fileContent = file.content || ''

      if (!filePath) {
        results.push(`❌ 跳过: 缺少文件名`)
        continue
      }

      const result = await window.electronAPI.file.write(workspacePath, filePath, fileContent)
      if (result.success) {
        results.push(`✅ ${filePath}`)
        successCount++
      } else {
        results.push(`❌ ${filePath}: ${result.error || '写入失败'}`)
      }
    }

    return {
      success: successCount > 0,
      output: `批量写入完成 (${successCount}/${files.length}):\n${results.join('\n')}`,
      error: successCount === files.length ? undefined : '部分文件写入失败',
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `批量写文件错误: ${(error as Error).message}`,
    }
  }
}

// Execute Python code directly
async function executePythonCode(
  actionInput: string | Record<string, unknown>,
  workspacePath: string,
  config: Record<string, unknown>
): Promise<ToolResult> {
  try {
    // Parse code from input
    let code: string
    let saveAs: string | undefined

    if (typeof actionInput === 'object') {
      code = (actionInput.code as string) || ''
      saveAs = actionInput.saveAs as string | undefined
    } else {
      const parsed = JSON.parse(actionInput)
      code = parsed.code || ''
      saveAs = parsed.saveAs
    }

    if (!code.trim()) {
      return { success: false, output: '', error: '未提供 Python 代码' }
    }

    // Save code to temporary file
    const tempFile = saveAs || `_temp_python_${Date.now()}.py`
    const writeResult = await window.electronAPI.file.write(workspacePath, tempFile, code)

    if (!writeResult.success) {
      return { success: false, output: '', error: `写入临时文件失败: ${writeResult.error}` }
    }

    // Execute the Python script
    const timeout = (config.timeout as number) || 60000
    // Try python3 first (Mac/Linux), fall back to python (Windows)
    const isWindows = typeof navigator !== 'undefined' && /windows|win/i.test(navigator.userAgent)
    const pythonCmd = isWindows ? 'python' : 'python3'

    const result = await window.electronAPI.command.execute(workspacePath, {
      command: `${pythonCmd} ${tempFile}`,
      cwd: '',
      timeout,
    })

    // Note: Temporary files are left in workspace for debugging purposes
    // They can be manually cleaned up if needed

    const output = result.stdout || ''
    const stderr = result.stderr || ''

    if (!result.success) {
      return {
        success: false,
        output: output + (stderr ? `\n错误: ${stderr}` : ''),
        error: `执行失败 (退出码: ${result.exitCode}): ${stderr}`,
      }
    }

    return {
      success: true,
      output: output + (saveAs ? `\n代码已保存到: ${saveAs}` : ''),
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `执行 Python 错误: ${(error as Error).message}`,
    }
  }
}

// Execute web search using SimpleXNG
async function executeWebSearch(
  actionInput: string | Record<string, unknown>,
  config: Record<string, unknown>
): Promise<ToolResult> {
  try {
    // Parse input parameters
    let query: string
    let maxResults = 5
    let engines: string[] = []
    let timeRange: string | undefined

    if (typeof actionInput === 'object') {
      query = (actionInput.query as string) || ''
      maxResults = (actionInput.maxResults as number) || 5
      engines = (actionInput.engines as string[]) || []
      timeRange = actionInput.timeRange as string | undefined
    } else {
      try {
        const parsed = JSON.parse(actionInput)
        query = parsed.query || ''
        maxResults = parsed.maxResults || 5
        engines = parsed.engines || []
        timeRange = parsed.timeRange
      } catch {
        // Use input as query directly
        query = actionInput
      }
    }

    if (!query.trim()) {
      return { success: false, output: '', error: '搜索关键词不能为空' }
    }

    // Get SimpleXNG endpoint from config, or from IPC settings, or use default
    let baseUrl = config.endpoint as string | undefined
    if (!baseUrl) {
      try {
        baseUrl = await window.electronAPI.simplexng.getEndpoint()
        console.log('[webSearch] Loaded endpoint from settings:', baseUrl)
      } catch (error) {
        console.warn('[webSearch] Failed to load endpoint from settings:', error)
      }
    }
    baseUrl = baseUrl || 'http://localhost:8888'
    console.log('[webSearch] Using endpoint:', baseUrl, 'for query:', query)

    // Build search URL
    const searchUrl = new URL(`${baseUrl}/search`)
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('format', 'json')

    if (engines.length > 0) {
      searchUrl.searchParams.set('engines', engines.join(','))
    }
    if (timeRange) {
      searchUrl.searchParams.set('time_range', timeRange)
    }

    const timeout = (config.timeout as number) || 30000

    // Execute search request via main process
    const result = await window.electronAPI.http.fetch({
      url: searchUrl.toString(),
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      timeout,
    })

    if (!result.success) {
      return {
        success: false,
        output: '',
        error: `搜索请求失败: ${result.error || `HTTP ${result.status}`}`,
      }
    }

    // Parse response
    interface SearchResult {
      url: string
      title: string
      snippet?: string
      content?: string
      engine?: string
      engines?: string[]
      score?: number
    }

    let response: { results: SearchResult[] }

    try {
      response = JSON.parse(result.body)
    } catch {
      return {
        success: false,
        output: '',
        error: '无法解析搜索结果',
      }
    }

    if (!response.results || response.results.length === 0) {
      return {
        success: true,
        output: `未找到与 "${query}" 相关的搜索结果`,
      }
    }

    // Format and limit results
    const limitedResults = response.results.slice(0, Math.min(maxResults, 10))

    const lines: string[] = []
    lines.push(`搜索关键词: "${query}"`)
    lines.push(`找到 ${limitedResults.length} 条结果:\n`)

    limitedResults.forEach((item, index) => {
      lines.push(`## 结果 ${index + 1}`)
      lines.push(`**标题**: ${item.title}`)
      lines.push(`**链接**: ${item.url}`)

      if (item.snippet) {
        lines.push(`**摘要**: ${item.snippet}`)
      }

      if (item.content && item.content !== item.snippet) {
        // Truncate long content
        const content = item.content.length > 500 ? item.content.substring(0, 500) + '...' : item.content
        lines.push(`**内容**: ${content}`)
      }

      if (item.engines && item.engines.length > 0) {
        lines.push(`**来源引擎**: ${item.engines.join(', ')}`)
      }

      lines.push('') // Empty line between results
    })

    return {
      success: true,
      output: lines.join('\n'),
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `网页搜索错误: ${(error as Error).message}`,
    }
  }
}

// Execute fetch URL tool - fetch and parse web content
async function executeFetchUrl(
  actionInput: string | Record<string, unknown>,
  config: Record<string, unknown>
): Promise<ToolResult> {
  try {
    // Parse input parameters
    let url: string
    let maxContentLength = (config.maxContentLength as number) || 5000
    let timeout = (config.timeout as number) || 30000
    let outputFormat: 'markdown' | 'text' = 'markdown'

    if (typeof actionInput === 'object') {
      url = (actionInput.url as string) || ''
      maxContentLength = (actionInput.maxContentLength as number) || maxContentLength
      timeout = (actionInput.timeout as number) || timeout
      if (actionInput.outputFormat) outputFormat = actionInput.outputFormat as 'markdown' | 'text'
    } else {
      try {
        const parsed = JSON.parse(actionInput)
        url = parsed.url || ''
        maxContentLength = parsed.maxContentLength || maxContentLength
        timeout = parsed.timeout || timeout
        if (parsed.outputFormat) outputFormat = parsed.outputFormat
      } catch {
        // Use input as URL directly
        url = actionInput
      }
    }

    if (!url.trim()) {
      return { success: false, output: '', error: 'URL 不能为空' }
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return { success: false, output: '', error: '无效的 URL 格式' }
    }

    // Use main process to fetch and parse
    const result = await window.electronAPI.webParser.fetchAndParse(url, {
      maxContentLength,
      includeLinks: true,
      outputFormat,
      timeout,
    })

    if (result.error) {
      return {
        success: false,
        output: '',
        error: `获取网页失败: ${result.error}`,
      }
    }

    // Format result for LLM
    const formattedContent = formatParsedContent(result, maxContentLength)

    return {
      success: true,
      output: formattedContent,
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `获取网页错误: ${(error as Error).message}`,
    }
  }
}

// Execute math calculate tool
async function executeMathCalculate(
  actionInput: string | Record<string, unknown>
): Promise<ToolResult> {
  try {
    // Parse input parameters
    let expression: string
    let precision: number | undefined
    let outputFormat: 'auto' | 'decimal' | 'fraction' | 'percent' = 'auto'

    if (typeof actionInput === 'object') {
      expression = (actionInput.expression as string) || ''
      precision = actionInput.precision as number | undefined
      outputFormat = (actionInput.outputFormat as 'auto' | 'decimal' | 'fraction' | 'percent') || 'auto'
    } else {
      // Try to parse as JSON first, then use as raw expression
      try {
        const parsed = JSON.parse(actionInput)
        expression = parsed.expression || actionInput
        precision = parsed.precision
        outputFormat = parsed.outputFormat || 'auto'
      } catch {
        expression = actionInput
      }
    }

    if (!expression.trim()) {
      return { success: false, output: '', error: '数学表达式不能为空' }
    }

    const result = mathCalculate({
      expression,
      precision,
      outputFormat,
    })

    if (!result.success) {
      return {
        success: false,
        output: '',
        error: result.error || '计算失败',
      }
    }

    // Format output with additional context
    let output = result.result
    if (result.isExact !== undefined) {
      output += result.isExact ? ' (精确值)' : ''
    }

    return {
      success: true,
      output,
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `数学计算错误: ${(error as Error).message}`,
    }
  }
}

// Execute math statistics tool
async function executeMathStatistics(
  actionInput: string | Record<string, unknown>
): Promise<ToolResult> {
  try {
    // Parse input parameters
    let data: number[] = []
    let operations: string[] = []

    if (typeof actionInput === 'object') {
      data = (actionInput.data as number[]) || []
      operations = (actionInput.operations as string[]) || []
    } else {
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(actionInput)
        data = parsed.data || []
        operations = parsed.operations || []
      } catch {
        return {
          success: false,
          output: '',
          error: '无法解析统计数据，请使用 JSON 格式: {"data": [1,2,3], "operations": ["mean", "median"]}',
        }
      }
    }

    if (!Array.isArray(data) || data.length === 0) {
      return { success: false, output: '', error: '数据必须是非空数组' }
    }

    if (!Array.isArray(operations) || operations.length === 0) {
      return {
        success: false,
        output: '',
        error: '请指定至少一个统计操作 (mean, median, mode, variance, stddev, sum, max, min, range, count)',
      }
    }

    const result = mathStatistics({
      data,
      operations: operations as Array<
        'mean' | 'median' | 'mode' | 'variance' | 'stddev' | 'sum' | 'max' | 'min' | 'range' | 'count'
      >,
    })

    if (!result.success) {
      return {
        success: false,
        output: '',
        error: result.error || '统计计算失败',
      }
    }

    // Format output as readable text
    const lines: string[] = ['统计结果:']
    for (const [op, value] of Object.entries(result.results)) {
      lines.push(`  ${op}: ${value}`)
    }

    return {
      success: true,
      output: lines.join('\n'),
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `统计计算错误: ${(error as Error).message}`,
    }
  }
}

// Execute math number theory tool
function executeMathNumberTheory(
  actionInput: string | Record<string, unknown>
): ToolResult {
  try {
    let params: Record<string, unknown> = {}

    if (typeof actionInput === 'object') {
      params = actionInput
    } else {
      try {
        params = JSON.parse(actionInput)
      } catch {
        return {
          success: false,
          output: '',
          error: '无法解析输入，请使用 JSON 格式',
        }
      }
    }

    const result = mathNumberTheory(params as unknown as Parameters<typeof mathNumberTheory>[0])

    if (!result.success) {
      return {
        success: false,
        output: '',
        error: result.error || '数论计算失败',
      }
    }

    return {
      success: true,
      output: typeof result.result === 'object'
        ? JSON.stringify(result.result, null, 2)
        : String(result.result),
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `数论计算错误: ${(error as Error).message}`,
    }
  }
}

// Execute math linear algebra tool
function executeMathLinearAlgebra(
  actionInput: string | Record<string, unknown>
): ToolResult {
  try {
    let params: Record<string, unknown> = {}

    if (typeof actionInput === 'object') {
      params = actionInput
    } else {
      try {
        params = JSON.parse(actionInput)
      } catch {
        return {
          success: false,
          output: '',
          error: '无法解析输入，请使用 JSON 格式',
        }
      }
    }

    const result = mathLinearAlgebra(params as unknown as Parameters<typeof mathLinearAlgebra>[0])

    if (!result.success) {
      return {
        success: false,
        output: '',
        error: result.error || '线性代数计算失败',
      }
    }

    return {
      success: true,
      output: typeof result.result === 'object'
        ? JSON.stringify(result.result, null, 2)
        : String(result.result),
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `线性代数计算错误: ${(error as Error).message}`,
    }
  }
}

// Execute math unit convert tool
function executeMathUnitConvert(
  actionInput: string | Record<string, unknown>
): ToolResult {
  try {
    let params: { value?: number; from?: string; to?: string } = {}

    if (typeof actionInput === 'object') {
      params = actionInput as { value?: number; from?: string; to?: string }
    } else {
      try {
        params = JSON.parse(actionInput)
      } catch {
        return {
          success: false,
          output: '',
          error: '无法解析输入，请使用 JSON 格式: {"value": 100, "from": "km", "to": "mile"}',
        }
      }
    }

    if (params.value === undefined || !params.from || !params.to) {
      return {
        success: false,
        output: '',
        error: '需要 value、from 和 to 参数',
      }
    }

    const result = mathUnitConvert({
      value: params.value,
      from: params.from,
      to: params.to,
    })

    if (!result.success || !result.result) {
      return {
        success: false,
        output: '',
        error: result.error || '单位转换失败',
      }
    }

    return {
      success: true,
      output: result.result.expression || `${result.result.value} ${result.result.to}`,
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `单位转换错误: ${(error as Error).message}`,
    }
  }
}

// Execute math probability tool
function executeMathProbability(
  actionInput: string | Record<string, unknown>
): ToolResult {
  try {
    let params: Record<string, unknown> = {}

    if (typeof actionInput === 'object') {
      params = actionInput
    } else {
      try {
        params = JSON.parse(actionInput)
      } catch {
        return {
          success: false,
          output: '',
          error: '无法解析输入，请使用 JSON 格式',
        }
      }
    }

    const result = mathProbability(params as unknown as Parameters<typeof mathProbability>[0])

    if (!result.success) {
      return {
        success: false,
        output: '',
        error: result.error || '概率计算失败',
      }
    }

    return {
      success: true,
      output: typeof result.result === 'object'
        ? JSON.stringify(result.result, null, 2)
        : String(result.result),
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `概率计算错误: ${(error as Error).message}`,
    }
  }
}

// Execute math calculus tool
function executeMathCalculus(
  actionInput: string | Record<string, unknown>
): ToolResult {
  try {
    let params: Record<string, unknown> = {}

    if (typeof actionInput === 'object') {
      params = actionInput
    } else {
      try {
        params = JSON.parse(actionInput)
      } catch {
        return {
          success: false,
          output: '',
          error: '无法解析输入，请使用 JSON 格式',
        }
      }
    }

    const result = mathCalculus(params as unknown as Parameters<typeof mathCalculus>[0])

    if (!result.success) {
      return {
        success: false,
        output: '',
        error: result.error || '微积分计算失败',
      }
    }

    return {
      success: true,
      output: typeof result.result === 'object'
        ? JSON.stringify(result.result, null, 2)
        : String(result.result),
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `微积分计算错误: ${(error as Error).message}`,
    }
  }
}

// Execute math equation tool
function executeMathEquation(
  actionInput: string | Record<string, unknown>
): ToolResult {
  try {
    let params: Record<string, unknown> = {}

    if (typeof actionInput === 'object') {
      params = actionInput
    } else {
      try {
        params = JSON.parse(actionInput)
      } catch {
        return {
          success: false,
          output: '',
          error: '无法解析输入，请使用 JSON 格式',
        }
      }
    }

    const result = mathEquation(params as unknown as Parameters<typeof mathEquation>[0])

    if (!result.success) {
      return {
        success: false,
        output: '',
        error: result.error || '方程求解失败',
      }
    }

    return {
      success: true,
      output: typeof result.result === 'object'
        ? JSON.stringify(result.result, null, 2)
        : String(result.result),
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `方程求解错误: ${(error as Error).message}`,
    }
  }
}

// Main tool execution function
export async function executeTool(
  tool: ToolDefinition,
  actionInput: string | Record<string, unknown>,
  context: ExecutionContext,
  todosManager?: TodosManager
): Promise<ToolResult> {
  const { workspacePath } = context

  switch (tool.type) {
    case 'readFile':
      return executeReadFile(actionInput, workspacePath)

    case 'writeFile':
      return executeWriteFile(tool.config, actionInput, workspacePath)

    case 'executeCommand':
      return executeShellCommand(actionInput, workspacePath, tool.config)

    case 'httpRequest':
      return executeHttpRequest(actionInput, tool.config)

    case 'writeMultipleFiles':
      return executeWriteMultipleFiles(actionInput, workspacePath)

    case 'executePython':
      return executePythonCode(actionInput, workspacePath, tool.config)

    case 'getCurrentDate':
      return executeGetCurrentDate(actionInput)

    case 'todos': {
      if (!todosManager) {
        return { success: false, output: '', error: 'TodosManager 未初始化' }
      }

      const parsed = parseTodosInput(actionInput)
      if (!parsed) {
        return {
          success: false,
          output: '',
          error: '无法解析 todos 操作。请使用 JSON 格式调用，例如: {"action": "init", "tasks": ["任务1", "任务2"]} 或 {"action": "complete", "content": "任务关键词"}',
        }
      }
      return todosManager.execute(parsed.action, parsed.content, parsed.taskId, parsed.tasks)
    }

    // Browser tools
    case 'browser_navigate':
    case 'browser_click':
    case 'browser_type':
    case 'browser_scroll':
    case 'browser_screenshot':
    case 'browser_getContent':
    case 'browser_evaluate':
    case 'browser_wait':
      return executeBrowserTool(tool.type, actionInput, workspacePath)

    case 'webSearch':
      return executeWebSearch(actionInput, tool.config)

    case 'fetchUrl':
      return executeFetchUrl(actionInput, tool.config)

    case 'math_calculate':
      return executeMathCalculate(actionInput)

    case 'math_statistics':
      return executeMathStatistics(actionInput)

    case 'math_number_theory':
      return executeMathNumberTheory(actionInput)

    case 'math_linear_algebra':
      return executeMathLinearAlgebra(actionInput)

    case 'math_unit_convert':
      return executeMathUnitConvert(actionInput)

    case 'math_probability':
      return executeMathProbability(actionInput)

    case 'math_calculus':
      return executeMathCalculus(actionInput)

    case 'math_equation':
      return executeMathEquation(actionInput)

    default:
      return { success: false, output: '', error: `未知工具类型: ${tool.type}` }
  }
}
