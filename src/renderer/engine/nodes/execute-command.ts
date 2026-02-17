import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, ExecuteCommandNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'

export function createExecuteCommandExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as ExecuteCommandNodeData

      // Interpolate command
      // Priority: 
      // 1. If user has configured command in properties panel, use that
      // 2. Otherwise, try to use input.command (if it's a valid command string)
      const configuredCommand = interpolateVariables(data.command, { ...context.variables, ...input })
      
      // If user has configured command in properties panel, use that
      let command = configuredCommand
      if (!configuredCommand || configuredCommand.trim() === '') {
        // Try to use input.command as fallback
        let inputCommand = ''
        if (input.command !== undefined && input.command !== null) {
          if (typeof input.command === 'string') {
            inputCommand = input.command
          } else if (typeof input.command === 'object') {
            // If input.command is an object, try to extract a meaningful string value
            const obj = input.command as Record<string, unknown>
            if ('value' in obj && typeof obj.value === 'string') {
              // Input node returns { value, prompt, inputType }
              inputCommand = obj.value
            } else if ('content' in obj && typeof obj.content === 'string') {
              inputCommand = obj.content
            } else if ('stdout' in obj && typeof obj.stdout === 'string') {
              inputCommand = obj.stdout
            } else if ('text' in obj && typeof obj.text === 'string') {
              inputCommand = obj.text
            }
          } else {
            inputCommand = String(input.command)
          }
        }
        if (inputCommand && inputCommand !== 'true' && inputCommand !== 'false') {
          command = inputCommand
        }
      }

      const cwd = interpolateVariables(data.cwd, { ...context.variables, ...input }) || undefined

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'debug',
        message: `执行命令: ${command}`,
        data: { command, cwd },
      })

      const result = await window.electronAPI.command.execute(context.workspacePath, {
        command,
        cwd,
        timeout: data.timeout,
      })

      if (!result.success && !data.continueOnError) {
        throw new Error(`命令执行失败,退出码 ${result.exitCode}: ${result.stderr || result.stdout}`)
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: result.success ? 'info' : 'warn',
        message: result.success
          ? `命令完成 (退出码: ${result.exitCode})`
          : `命令失败 (退出码: ${result.exitCode})`,
        data: {
          stdout: result.stdout.slice(0, 1000), // Truncate for logging
          stderr: result.stderr.slice(0, 500),
        },
      })

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        success: result.success,
        timedOut: result.timedOut,
      }
    },
  }
}
