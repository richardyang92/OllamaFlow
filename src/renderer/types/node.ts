import { Node } from '@xyflow/react'

// Port types
export type PortDataType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'

export interface PortDefinition {
  id: string
  name: string
  label: string
  dataType: PortDataType
  required?: boolean
  multiple?: boolean
}

// Node types
export type NodeType =
  | 'manualTrigger'
  | 'input'
  | 'ollamaChat'
  | 'set'
  | 'if'
  | 'output'
  | 'readFile'
  | 'writeFile'
  | 'executeCommand'

// Node status
export type NodeStatus = 'idle' | 'running' | 'success' | 'error'

// Base node data
export interface BaseNodeData extends Record<string, unknown> {
  label: string
  nodeType: NodeType
  description?: string
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  status?: NodeStatus
  error?: string
}

// Manual Trigger Node
export interface ManualTriggerNodeData extends BaseNodeData {
  nodeType: 'manualTrigger'
}

// Input Node
export interface InputNodeData extends BaseNodeData {
  nodeType: 'input'
  inputType: 'string' | 'number' | 'boolean'
  defaultValue: string
  prompt: string
}

// Ollama Chat Node
export interface OllamaChatNodeData extends BaseNodeData {
  nodeType: 'ollamaChat'
  model: string
  systemPrompt: string
  userMessage: string
  temperature: number
  topP: number
  maxTokens: number
  stream: boolean
}

// Set Node
export interface SetNodeData extends BaseNodeData {
  nodeType: 'set'
  variableName: string
  variableValue: string
  useExpression: boolean
}

// If Node
export interface IfNodeData extends BaseNodeData {
  nodeType: 'if'
  expression: string
}

// Output Node
export interface OutputNodeData extends BaseNodeData {
  nodeType: 'output'
  outputType: 'display' | 'copy' | 'download'
}

// Read File Node
export interface ReadFileNodeData extends BaseNodeData {
  nodeType: 'readFile'
  filePath: string
  encoding: string
  errorIfNotFound: boolean
}

// Write File Node
export interface WriteFileNodeData extends BaseNodeData {
  nodeType: 'writeFile'
  filePath: string
  writeMode: 'overwrite' | 'append'
  contentSource: 'input' | 'direct'
  directContent: string
}

// Execute Command Node
export interface ExecuteCommandNodeData extends BaseNodeData {
  nodeType: 'executeCommand'
  command: string
  cwd: string
  timeout: number
  continueOnError: boolean
}

// Union type for all node data
export type WorkflowNodeData =
  | ManualTriggerNodeData
  | InputNodeData
  | OllamaChatNodeData
  | SetNodeData
  | IfNodeData
  | OutputNodeData
  | ReadFileNodeData
  | WriteFileNodeData
  | ExecuteCommandNodeData

// Workflow node type
export type WorkflowNode = Node<WorkflowNodeData>

// Node templates for creating new nodes
export interface NodeTemplate {
  type: NodeType
  label: string
  icon: string
  category: string
  description: string
  defaultData: Partial<WorkflowNodeData>
}

export const nodeTemplates: NodeTemplate[] = [
  {
    type: 'manualTrigger',
    label: 'Manual Trigger',
    icon: '▶️',
    category: 'Triggers',
    description: 'Start workflow manually',
    defaultData: {
      nodeType: 'manualTrigger',
      label: 'Manual Trigger',
      inputs: [],
      outputs: [{ id: 'trigger', name: 'trigger', label: 'Trigger', dataType: 'any' }],
    },
  },
  {
    type: 'input',
    label: 'Input',
    icon: '📥',
    category: 'Input',
    description: 'Get user input during workflow execution',
    defaultData: {
      nodeType: 'input',
      label: 'Input',
      inputType: 'string',
      defaultValue: '',
      prompt: 'Please enter a value:',
      inputs: [],
      outputs: [{ id: 'value', name: 'value', label: 'Value', dataType: 'any' }],
    },
  },
  {
    type: 'ollamaChat',
    label: 'Ollama Chat',
    icon: '🤖',
    category: 'AI',
    description: 'Chat with Ollama model',
    defaultData: {
      nodeType: 'ollamaChat',
      label: 'Ollama Chat',
      model: 'llama3.1',
      systemPrompt: 'You are a helpful assistant.',
      userMessage: '{{input}}',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      stream: true,
      inputs: [{ id: 'input', name: 'input', label: 'Input', dataType: 'string' }],
      outputs: [{ id: 'response', name: 'response', label: 'Response', dataType: 'string' }],
    },
  },
  {
    type: 'set',
    label: 'Set',
    icon: '✏️',
    category: 'Data',
    description: 'Set a variable',
    defaultData: {
      nodeType: 'set',
      label: 'Set',
      variableName: 'value',
      variableValue: '',
      useExpression: false,
      inputs: [{ id: 'input', name: 'input', label: 'Input', dataType: 'any' }],
      outputs: [{ id: 'value', name: 'value', label: 'Value', dataType: 'any' }],
    },
  },
  {
    type: 'if',
    label: 'If',
    icon: '🔀',
    category: 'Logic',
    description: 'Conditional branching',
    defaultData: {
      nodeType: 'if',
      label: 'If',
      expression: '{{input}} == true',
      inputs: [{ id: 'input', name: 'input', label: 'Input', dataType: 'any' }],
      outputs: [
        { id: 'true', name: 'true', label: 'True', dataType: 'any' },
        { id: 'false', name: 'false', label: 'False', dataType: 'any' },
      ],
    },
  },
  {
    type: 'output',
    label: 'Output',
    icon: '📤',
    category: 'Output',
    description: 'Display output',
    defaultData: {
      nodeType: 'output',
      label: 'Output',
      outputType: 'display',
      inputs: [{ id: 'data', name: 'data', label: 'Data', dataType: 'any' }],
      outputs: [{ id: 'data', name: 'data', label: 'Data', dataType: 'any' }],
    },
  },
  {
    type: 'readFile',
    label: 'Read File',
    icon: '📄',
    category: 'File',
    description: 'Read file from workspace',
    defaultData: {
      nodeType: 'readFile',
      label: 'Read File',
      filePath: 'data/input.txt',
      encoding: 'utf-8',
      errorIfNotFound: true,
      inputs: [{ id: 'path', name: 'path', label: 'Path', dataType: 'string' }],
      outputs: [
        { id: 'content', name: 'content', label: 'Content', dataType: 'string' },
        { id: 'exists', name: 'exists', label: 'Exists', dataType: 'boolean' },
      ],
    },
  },
  {
    type: 'writeFile',
    label: 'Write File',
    icon: '💾',
    category: 'File',
    description: 'Write file to workspace',
    defaultData: {
      nodeType: 'writeFile',
      label: 'Write File',
      filePath: 'data/output.txt',
      writeMode: 'overwrite',
      contentSource: 'input',
      directContent: '',
      inputs: [{ id: 'content', name: 'content', label: 'Content', dataType: 'string' }],
      outputs: [
        { id: 'success', name: 'success', label: 'Success', dataType: 'boolean' },
        { id: 'path', name: 'path', label: 'Path', dataType: 'string' },
      ],
    },
  },
  {
    type: 'executeCommand',
    label: 'Execute Command',
    icon: '⚡',
    category: 'System',
    description: 'Execute shell command',
    defaultData: {
      nodeType: 'executeCommand',
      label: 'Execute Command',
      command: '',
      cwd: '',
      timeout: 30000,
      continueOnError: false,
      inputs: [{ id: 'command', name: 'command', label: 'Command', dataType: 'string' }],
      outputs: [
        { id: 'stdout', name: 'stdout', label: 'Stdout', dataType: 'string' },
        { id: 'stderr', name: 'stderr', label: 'Stderr', dataType: 'string' },
        { id: 'exitCode', name: 'exitCode', label: 'Exit Code', dataType: 'number' },
      ],
    },
  },
]
