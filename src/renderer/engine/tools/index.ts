import type { ToolDefinition, TodoItem, TodosAction, AvailableToolId } from '@/types/node'
import { AVAILABLE_TOOLS as availableTools } from '@/types/node'
import type { ExecutionContext } from '../executor'

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

        // Clear existing and add all tasks
        this.todos = []
        const now = Date.now()
        for (let i = 0; i < taskList.length; i++) {
          this.todos.push({
            id: `todo-${now + i}`,
            content: taskList[i].trim(),
            completed: false,
            createdAt: now + i,
          })
        }

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
        this.todos.push(newTodo)
        return {
          success: true,
          output: `已添加任务: "${newTodo.content}" (ID: ${newTodo.id})`,
        }
      }

      case 'complete': {
        // Mark task as completed
        const todoToComplete = this.todos.find(
          (t) => t.id === taskId || (content && t.content.includes(content))
        )
        if (todoToComplete) {
          todoToComplete.completed = true
          return {
            success: true,
            output: `已完成任务: "${todoToComplete.content}"`,
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
          const removed = this.todos.splice(index, 1)[0]
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
  actionInput: string
): { action: TodosAction; content?: string; taskId?: string; tasks?: string[] } | null {
  try {
    const parsed = JSON.parse(actionInput)
    return {
      action: parsed.action as TodosAction,
      content: parsed.content,
      taskId: parsed.taskId,
      tasks: parsed.tasks,
    }
  } catch {
    // Try to parse simple format
    const parts = actionInput.split(',').map((p) => p.trim())
    if (parts.length >= 1) {
      return {
        action: parts[0] as TodosAction,
        content: parts.slice(1).join(','),
      }
    }
    return null
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

    if (typeof actionInput === 'object') {
      url = (actionInput.url as string) || ''
      // Allow override from actionInput
      if (actionInput.method) method = actionInput.method as string
      if (actionInput.headers) headers = { ...headers, ...(actionInput.headers as Record<string, string>) }
      if (actionInput.body) body = actionInput.body as string
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

    return {
      success: result.success,
      output: result.body,
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

// Main tool execution function
export async function executeTool(
  tool: ToolDefinition,
  actionInput: string | Record<string, unknown>,
  context: ExecutionContext,
  todosManager?: TodosManager
): Promise<ToolResult> {
  const { workspacePath } = context

  // Convert object input to string if needed
  const inputStr = typeof actionInput === 'object'
    ? JSON.stringify(actionInput)
    : actionInput

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
      const parsed = parseTodosInput(inputStr)
      if (!parsed) {
        return {
          success: false,
          output: '',
          error: '无法解析 todos 操作输入，请使用 JSON 格式: {"action": "操作", "content": "内容"} 或 {"action": "init", "tasks": ["任务1", "任务2"]}',
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

    default:
      return { success: false, output: '', error: `未知工具类型: ${tool.type}` }
  }
}
