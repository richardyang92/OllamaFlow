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

// 获取所有启用的工具定义（始终包含内置的 todos 工具）
export function getEnabledTools(enabledToolIds: AvailableToolId[]): ToolDefinition[] {
  // 始终包含 todos 工具
  const todosTool = getToolById('todos')
  const userTools = enabledToolIds
    .filter((id) => id !== 'todos') // 排除 todos，稍后统一添加
    .map((id) => getToolById(id))
    .filter((t): t is ToolDefinition => t !== undefined)

  if (todosTool) {
    return [todosTool, ...userTools]
  }
  return userTools
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

    default:
      return { success: false, output: '', error: `未知工具类型: ${tool.type}` }
  }
}
