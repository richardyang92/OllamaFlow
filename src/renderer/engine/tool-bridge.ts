/**
 * Tool Bridge
 * 
 * 在 Worker 和主线程之间桥接工具执行
 * Worker 请求执行工具 -> 主线程调用 electronAPI -> 返回结果给 Worker
 */

import type { ToolCallInfo, ToolResult } from './workers/types'

export interface ToolBridgeContext {
  workspacePath: string
  executionId?: string
  apiEndpoint?: string
  apiKey?: string
}

export async function executeToolInBridge(
  toolCall: ToolCallInfo,
  context: ToolBridgeContext
): Promise<ToolResult> {
  const { toolName, input } = toolCall
  
  try {
    switch (toolName) {
      case 'readFile':
        return await executeReadFile(input, context.workspacePath)
      
      case 'writeFile':
        return await executeWriteFile(input, context.workspacePath)
      
      case 'executeCommand':
        return await executeCommand(input, context.workspacePath)
      
      case 'todos':
        return executeTodos(input)
      
      case 'getCurrentDate':
        return executeGetCurrentDate(input)
      
      default:
        if (toolName.startsWith('workflow_')) {
          return await executeWorkflow(toolName, input, context.workspacePath)
        }
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function executeReadFile(
  input: Record<string, unknown>,
  workspacePath: string
): Promise<ToolResult> {
  try {
    const filePath = input.filePath as string
    const result = await window.electronAPI.file.read(workspacePath, filePath)
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to read file' }
    }
    
    return { success: true, output: result.content || '' }
  } catch (error) {
    return {
      success: false,
      error: `Read file error: ${(error as Error).message}`,
    }
  }
}

async function executeWriteFile(
  input: Record<string, unknown>,
  workspacePath: string
): Promise<ToolResult> {
  try {
    const filePath = (input.filePath || input.filename) as string
    const content = input.content as string
    
    const result = await window.electronAPI.file.write(workspacePath, filePath, content)
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to write file' }
    }
    
    return { success: true, output: `File written: ${filePath}` }
  } catch (error) {
    return {
      success: false,
      error: `Write file error: ${(error as Error).message}`,
    }
  }
}

async function executeCommand(
  input: Record<string, unknown>,
  workspacePath: string
): Promise<ToolResult> {
  try {
    const command = input.command as string
    const timeout = (input.timeout as number) || 30000
    
    const result = await window.electronAPI.command.execute(workspacePath, {
      command,
      timeout,
    })
    
    if (!result.success) {
      return {
        success: false,
        output: result.stdout || '',
        error: `Command failed (exit code: ${result.exitCode}): ${result.stderr}`,
      }
    }
    
    return { success: true, output: result.stdout || '' }
  } catch (error) {
    return {
      success: false,
      error: `Execute command error: ${(error as Error).message}`,
    }
  }
}

function executeTodos(input: Record<string, unknown>): ToolResult {
  // Todos 应该在 Worker 中处理，这里只是占位
  return {
    success: true,
    output: `Todo action: ${input.action}`,
  }
}

function executeGetCurrentDate(input: Record<string, unknown>): ToolResult {
  const format = (input.format as string) || 'full'
  const now = new Date()
  
  let output: string
  
  switch (format) {
    case 'date':
      output = now.toISOString().split('T')[0]
      break
    case 'time':
      output = now.toTimeString().split(' ')[0]
      break
    case 'timestamp':
      output = String(Math.floor(now.getTime() / 1000))
      break
    case 'full':
    default: {
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')
      const weekDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
      output = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${weekDay}`
      break
    }
  }
  
  return { success: true, output }
}

async function executeWorkflow(
  toolName: string,
  input: Record<string, unknown>,
  workspacePath: string
): Promise<ToolResult> {
  // 提取 workflow ID
  const workflowId = toolName.replace('workflow_', '')
  
  // TODO: 实现工作流执行
  return {
    success: true,
    output: `Workflow ${workflowId} executed with input: ${JSON.stringify(input)}`,
  }
}
