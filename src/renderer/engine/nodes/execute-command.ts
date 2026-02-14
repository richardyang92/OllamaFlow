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
      const command = input.command
        ? String(input.command)
        : interpolateVariables(data.command, { ...context.variables, ...input })

      const cwd = interpolateVariables(data.cwd, { ...context.variables, ...input }) || undefined

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'debug',
        message: `Executing command: ${command}`,
        data: { command, cwd },
      })

      const result = await window.electronAPI.command.execute(context.workspacePath, {
        command,
        cwd,
        timeout: data.timeout,
      })

      if (!result.success && !data.continueOnError) {
        throw new Error(`Command failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`)
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: result.success ? 'info' : 'warn',
        message: result.success
          ? `Command completed (exit code: ${result.exitCode})`
          : `Command failed (exit code: ${result.exitCode})`,
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
