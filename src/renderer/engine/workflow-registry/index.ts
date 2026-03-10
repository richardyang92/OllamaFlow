/**
 * 工作流注册表
 * 用于发现和加载可用的工作流
 */

import type { StandardTool } from '../react-agent/llm/types'

// 输入节点元信息
export interface InputNodeMeta {
  id: string           // 节点 ID
  label: string        // 节点标签（如 "数据输入"）
  inputType: 'string' | 'number' | 'boolean'  // 数据类型
  prompt: string       // 输入提示/功能描述
  defaultValue?: string
}

// 工作流信息
export interface WorkflowInfo {
  id: string // 唯一标识，用于生成工具名称
  workspacePath: string
  name: string
  description?: string
  // 新增：输入节点元信息
  inputNodes?: InputNodeMeta[]
}

// 将工作流转换为工具定义
export function getWorkflowAsTool(workflow: WorkflowInfo): StandardTool {
  // 使用唯一 ID 作为工具名称，避免中文命名冲突
  const toolName = `workflow_${workflow.id}`

  // 构建基础描述
  let description = workflow.description
    ? `【${workflow.name}】${workflow.description}`
    : `【${workflow.name}】工作流`

  // 添加输入格式说明
  if (workflow.inputNodes && workflow.inputNodes.length > 0) {
    const inputDesc = workflow.inputNodes.map(node => {
      const typeDesc = {
        'string': '文本',
        'number': '数字',
        'boolean': '布尔值',
      }[node.inputType] || '任意'

      return `\n  - ${node.label}: ${typeDesc}${node.prompt ? ` (${node.prompt})` : ''}`
    }).join('')

    description += `\n\n输入要求:${inputDesc}`
  }

  return {
    name: toolName,
    description,
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

/**
 * 加载工作流的输入节点元信息
 */
export async function loadWorkflowInputMeta(
  workspacePath: string
): Promise<InputNodeMeta[]> {
  try {
    const workflowData = await window.electronAPI.workflow.loadData(workspacePath)
    if (!workflowData?.nodes) return []

    // 定义节点类型
    interface WorkflowNode {
      id: string
      type: string
      data: {
        label?: string
        inputType?: 'string' | 'number' | 'boolean'
        prompt?: string
        defaultValue?: string
      }
    }

    const inputNodes = (workflowData.nodes as WorkflowNode[]).filter(
      (n) => n.type === 'input'
    )

    return inputNodes.map((node) => ({
      id: node.id,
      label: node.data.label || 'input',
      inputType: node.data.inputType || 'string',
      prompt: node.data.prompt || '',
      defaultValue: node.data.defaultValue,
    }))
  } catch (error) {
    console.error('加载工作流输入元信息失败:', error)
    return []
  }
}
