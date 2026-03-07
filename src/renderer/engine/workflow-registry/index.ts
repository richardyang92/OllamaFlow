/**
 * 工作流注册表
 * 用于发现和加载可用的工作流
 */

import type { StandardTool } from '../react-agent/llm/types'

// 工作流信息
export interface WorkflowInfo {
  id: string // 唯一标识，用于生成工具名称
  workspacePath: string
  name: string
  description?: string
}

// 将工作流转换为工具定义
export function getWorkflowAsTool(workflow: WorkflowInfo): StandardTool {
  // 使用唯一 ID 作为工具名称，避免中文命名冲突
  const toolName = `workflow_${workflow.id}`

  return {
    name: toolName,
    description: workflow.description
      ? `【${workflow.name}】${workflow.description}`
      : `【${workflow.name}】工作流`,
    parameters: {
      type: 'object',
      properties: {
        input: {
          description: '工作流的输入参数。可以是字符串或对象，将传递给工作流的输入节点',
        },
      },
      required: [],
    },
  }
}

// 获取所有工作流的工具定义
export function getWorkflowsAsTools(workflows: WorkflowInfo[]): StandardTool[] {
  return workflows.map(getWorkflowAsTool)
}
