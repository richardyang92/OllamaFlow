import type { Workflow } from '@/types/workflow'
import type { WorkflowNode } from '@/types/node'
import type { Edge } from '@xyflow/react'
import { DEFAULT_NODE_PARAMS } from '@/config/model-config'

/**
 * Project template definition
 */
export interface ProjectTemplate {
  id: string
  name: string
  icon: string
  description: string
}

/**
 * Available project templates
 */
export const projectTemplates: ProjectTemplate[] = [
  {
    id: 'empty',
    name: '空白项目',
    icon: '📄',
    description: '从零开始创建工作流',
  },
  {
    id: 'basic-chat',
    name: '基础对话',
    icon: '💬',
    description: '包含一个 Ollama 对话节点的简单工作流',
  },
  {
    id: 'agent',
    name: '智能助手',
    icon: '🧠',
    description: '包含 ReAct 智能体的工作流',
  },
]

/**
 * Generate workflow data based on template ID
 */
export function generateTemplateWorkflow(
  templateId: string,
  projectName: string,
  defaultModel: string
): Workflow {
  const baseMetadata = {
    id: window.crypto.randomUUID(),
    name: projectName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
  }

  switch (templateId) {
    case 'basic-chat':
      return createBasicChatTemplate(baseMetadata, defaultModel)
    case 'agent':
      return createAgentTemplate(baseMetadata, defaultModel)
    case 'empty':
    default:
      return {
        metadata: baseMetadata,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        settings: {
          executionMode: 'sequential',
        },
      }
  }
}

/**
 * Create basic chat template: Input -> Ollama Chat -> Output
 */
function createBasicChatTemplate(
  metadata: Workflow['metadata'],
  defaultModel: string
): Workflow {
  const inputNodeId = 'node-input-1'
  const chatNodeId = 'node-chat-1'
  const outputNodeId = 'node-output-1'

  const nodes: WorkflowNode[] = [
    {
      id: inputNodeId,
      type: 'input',
      position: { x: 100, y: 200 },
      data: {
        nodeType: 'input',
        label: '用户输入',
        category: 'Input',
        inputType: 'string',
        defaultValue: '',
        prompt: '请输入您的问题:',
        inputs: [],
        outputs: [{ id: 'value', name: 'value', label: '值', dataType: 'any' }],
      },
    },
    {
      id: chatNodeId,
      type: 'ollamaChat',
      position: { x: 400, y: 200 },
      data: {
        nodeType: 'ollamaChat',
        label: 'AI 对话',
        category: 'AI',
        model: defaultModel,
        systemPrompt: '你是一个有用的助手。请简洁地回答用户的问题。',
        userMessage: '{{value}}',
        ...DEFAULT_NODE_PARAMS.ollamaChat,
        inputs: [{ id: 'input', name: 'input', label: '输入', dataType: 'string' }],
        outputs: [{ id: 'response', name: 'response', label: '响应', dataType: 'string' }],
      },
    },
    {
      id: outputNodeId,
      type: 'output',
      position: { x: 700, y: 200 },
      data: {
        nodeType: 'output',
        label: '输出结果',
        category: 'Output',
        outputType: 'display',
        sourceType: 'input',
        inputs: [{ id: 'data', name: 'data', label: '数据', dataType: 'any' }],
        outputs: [{ id: 'data', name: 'data', label: '数据', dataType: 'any' }],
      },
    },
  ]

  const edges: Edge[] = [
    {
      id: 'edge-input-chat',
      source: inputNodeId,
      target: chatNodeId,
      sourceHandle: 'value',
      targetHandle: 'input',
      animated: false,
    },
    {
      id: 'edge-chat-output',
      source: chatNodeId,
      target: outputNodeId,
      sourceHandle: 'response',
      targetHandle: 'data',
      animated: false,
    },
  ]

  return {
    metadata,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    settings: {
      executionMode: 'sequential',
    },
  }
}

/**
 * Create agent template: Input -> ReAct Agent -> Output
 */
function createAgentTemplate(
  metadata: Workflow['metadata'],
  defaultModel: string
): Workflow {
  const inputNodeId = 'node-input-1'
  const agentNodeId = 'node-agent-1'
  const outputNodeId = 'node-output-1'

  const nodes: WorkflowNode[] = [
    {
      id: inputNodeId,
      type: 'input',
      position: { x: 100, y: 200 },
      data: {
        nodeType: 'input',
        label: '任务输入',
        category: 'Input',
        inputType: 'string',
        defaultValue: '',
        prompt: '请描述您希望智能体完成的任务:',
        inputs: [],
        outputs: [{ id: 'value', name: 'value', label: '值', dataType: 'any' }],
      },
    },
    {
      id: agentNodeId,
      type: 'reactAgent',
      position: { x: 400, y: 200 },
      data: {
        nodeType: 'reactAgent',
        label: '智能助手',
        category: 'AI',
        model: defaultModel,
        systemPrompt: '你是一个善于分析和执行任务的智能助手。你可以使用各种工具来完成任务。请逐步思考并执行操作。',
        userMessage: '{{value}}',
        ...DEFAULT_NODE_PARAMS.reactAgent,
        enabledTools: ['todos', 'readFile', 'writeFile', 'executeCommand', 'httpRequest', 'getCurrentDate'],
        stream: true,
        inputs: [{ id: 'input', name: 'input', label: '输入', dataType: 'string' }],
        outputs: [{ id: 'response', name: 'response', label: '最终回答', dataType: 'string' }],
      },
    },
    {
      id: outputNodeId,
      type: 'output',
      position: { x: 700, y: 200 },
      data: {
        nodeType: 'output',
        label: '输出结果',
        category: 'Output',
        outputType: 'display',
        sourceType: 'input',
        inputs: [{ id: 'data', name: 'data', label: '数据', dataType: 'any' }],
        outputs: [{ id: 'data', name: 'data', label: '数据', dataType: 'any' }],
      },
    },
  ]

  const edges: Edge[] = [
    {
      id: 'edge-input-agent',
      source: inputNodeId,
      target: agentNodeId,
      sourceHandle: 'value',
      targetHandle: 'input',
      animated: false,
    },
    {
      id: 'edge-agent-output',
      source: agentNodeId,
      target: outputNodeId,
      sourceHandle: 'response',
      targetHandle: 'data',
      animated: false,
    },
  ]

  return {
    metadata,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    settings: {
      executionMode: 'sequential',
    },
  }
}
