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
  | 'input'
  | 'ollamaChat'
  | 'set'
  | 'if'
  | 'loop'
  | 'output'
  | 'image'
  | 'readFile'
  | 'writeFile'
  | 'executeCommand'
  | 'reactAgent'

// ReAct Agent Tool Definition
export interface ToolDefinition {
  id: string
  name: string
  description: string
  type: 'readFile' | 'writeFile' | 'executeCommand' | 'httpRequest' | 'todos'
  config: Record<string, unknown>
}

// Todos 工具的任务项
export interface TodoItem {
  id: string
  content: string
  completed: boolean
  createdAt: number
}

// Todos 工具的操作类型
export type TodosAction = 'add' | 'complete' | 'list' | 'remove' | 'clear' | 'init'

// 预定义的可用工具
export const AVAILABLE_TOOLS = [
  {
    id: 'todos',
    name: 'todos',
    label: '待办事项',
    description: '管理待办事项列表。一次性创建任务列表: {"action": "init", "tasks": ["任务1", "任务2", ...]}。单个操作: {"action": "add|complete|list|remove|clear", "content": "..."}',
    type: 'todos' as const,
    builtIn: true,
  },
  {
    id: 'executeCommand',
    name: 'executeCommand',
    label: '执行命令',
    description: '执行 Shell 命令。输入: 命令字符串（如 "python script.py"）。注意：不能直接执行多行代码，需先写入文件再执行',
    type: 'executeCommand' as const,
    builtIn: false,
  },
  {
    id: 'readFile',
    name: 'readFile',
    label: '读取文件',
    description: '从工作区读取文件内容。输入: 文件路径（如 "data/input.txt"）',
    type: 'readFile' as const,
    builtIn: false,
  },
  {
    id: 'writeFile',
    name: 'writeFile',
    label: '写入文件',
    description: '将内容写入工作区文件。输入JSON格式: {"filename": "文件路径", "content": "文件内容"}。用于保存代码、数据等',
    type: 'writeFile' as const,
    builtIn: false,
  },
  {
    id: 'httpRequest',
    name: 'httpRequest',
    label: 'HTTP 请求',
    description: '发送 HTTP 请求。输入: URL字符串',
    type: 'httpRequest' as const,
    builtIn: false,
  },
] as const

export type AvailableToolId = (typeof AVAILABLE_TOOLS)[number]['id']

// Node status
export type NodeStatus = 'idle' | 'running' | 'success' | 'error'

// ReAct Agent Step Status
export type ReActStepStatus = 'thinking' | 'acting' | 'observing' | 'completed' | 'error'

// Single ReAct reasoning step
export interface ReActStep {
  id: string
  iteration: number
  status: ReActStepStatus
  thought: string
  thoughtStreaming: boolean
  action: string | null
  actionInput: string | null
  observation: string | null
  observationStreaming: boolean
  observationError: boolean
  startedAt: number
  completedAt?: number
}

// ReAct Agent execution state (for streaming display)
export interface ReActExecutionState {
  nodeId: string
  isRunning: boolean
  currentIteration: number
  maxIterations: number
  steps: ReActStep[]
  finalAnswer: string | null
  error: string | null
  todos: TodoItem[]  // 待办事项列表
}

// Base node data
export interface BaseNodeData extends Record<string, unknown> {
  label: string
  nodeType: NodeType
  category: string
  description?: string
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  status?: NodeStatus
  error?: string
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

// Loop Node
export interface LoopNodeData extends BaseNodeData {
  nodeType: 'loop'
  loopMode: 'count' | 'array' | 'condition'
  count: number
  arraySource: string
  conditionExpression: string
  loopVariable: string
  indexVariable: string
  maxIterations: number
  bodyNodeIds: string[]
  collectResults: boolean
}

// Output Node
export interface OutputNodeData extends BaseNodeData {
  nodeType: 'output'
  outputType: 'display' | 'copy' | 'download'
  sourceType: 'input' | 'variable'  // 输入值或变量
  variableName?: string  // 当 sourceType 为 'variable' 时的变量名
  output?: string
}

// Image Node
export interface ImageNodeData extends BaseNodeData {
  nodeType: 'image'
  imageUrl?: string
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

// ReAct Agent Node
export interface ReactAgentNodeData extends BaseNodeData {
  nodeType: 'reactAgent'
  model: string
  systemPrompt: string
  userMessage: string
  temperature: number
  maxTokens: number
  maxIterations: number
  enabledTools: AvailableToolId[]
  stream: boolean
}


// Union type for all node data
export type WorkflowNodeData =
  | InputNodeData
  | OllamaChatNodeData
  | SetNodeData
  | IfNodeData
  | LoopNodeData
  | OutputNodeData
  | ImageNodeData
  | ReadFileNodeData
  | WriteFileNodeData
  | ExecuteCommandNodeData
  | ReactAgentNodeData

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
  colorScheme?: 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'cyan' | 'teal' | 'yellow'
}

export const nodeTemplates: NodeTemplate[] = [
  {
    type: 'input',
    label: '输入',
    icon: '📥',
    category: 'Input',
    colorScheme: 'cyan',
    description: '在工作流执行时获取用户输入',
    defaultData: {
      nodeType: 'input',
      label: '输入',
      category: 'Input',
      inputType: 'string',
      defaultValue: '',
      prompt: '请输入一个值:',
      inputs: [],
      outputs: [{ id: 'value', name: 'value', label: '值', dataType: 'any' }],
    },
  },
  {
    type: 'ollamaChat',
    label: 'Ollama 对话',
    icon: '🤖',
    category: 'AI',
    colorScheme: 'purple',
    description: '与 Ollama 模型对话',
    defaultData: {
      nodeType: 'ollamaChat',
      label: 'Ollama 对话',
      category: 'AI',
      model: 'glm-4.7-flash:latest',
      systemPrompt: '你是一个有用的助手。',
      userMessage: '{{input}}',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 8192,
      stream: true,
      inputs: [{ id: 'input', name: 'input', label: '输入', dataType: 'string' }],
      outputs: [{ id: 'response', name: 'response', label: '响应', dataType: 'string' }],
    },
  },
  {
    type: 'set',
    label: '设置变量',
    icon: '✏️',
    category: 'Data',
    colorScheme: 'yellow',
    description: '设置一个变量',
    defaultData: {
      nodeType: 'set',
      label: '设置变量',
      category: 'Data',
      variableName: 'value',
      variableValue: '',
      useExpression: false,
      inputs: [{ id: 'input', name: 'input', label: '输入', dataType: 'any' }],
      outputs: [{ id: 'value', name: 'value', label: '值', dataType: 'any' }],
    },
  },
  {
    type: 'if',
    label: '条件判断',
    icon: '🔀',
    category: 'Logic',
    colorScheme: 'blue',
    description: '条件分支',
    defaultData: {
      nodeType: 'if',
      label: '条件判断',
      category: 'Logic',
      expression: '{{input}} == true',
      inputs: [{ id: 'input', name: 'input', label: '输入', dataType: 'any' }],
      outputs: [
        { id: 'true', name: 'true', label: '真', dataType: 'any' },
        { id: 'false', name: 'false', label: '假', dataType: 'any' },
      ],
    },
  },
  {
    type: 'loop',
    label: '循环',
    icon: '🔄',
    category: 'Logic',
    colorScheme: 'blue',
    description: '循环执行',
    defaultData: {
      nodeType: 'loop',
      label: '循环',
      category: 'Logic',
      loopMode: 'count',
      count: 3,
      arraySource: '{{items}}',
      conditionExpression: '{{index}} < 10',
      loopVariable: 'item',
      indexVariable: 'index',
      maxIterations: 1000,
      bodyNodeIds: [],
      collectResults: true,
      inputs: [
        { id: 'input', name: 'input', label: '输入', dataType: 'any' },
        { id: 'array', name: 'array', label: '数组', dataType: 'array' },
      ],
      outputs: [
        { id: 'item', name: 'item', label: '当前项', dataType: 'any' },
        { id: 'index', name: 'index', label: '索引', dataType: 'number' },
        { id: 'results', name: 'results', label: '结果列表', dataType: 'array' },
        { id: 'completed', name: 'completed', label: '完成', dataType: 'any' },
      ],
    },
  },
  {
    type: 'output',
    label: '输出',
    icon: '📤',
    category: 'Output',
    colorScheme: 'teal',
    description: '显示输出',
    defaultData: {
      nodeType: 'output',
      label: '输出',
      category: 'Output',
      outputType: 'display',
      sourceType: 'input',
      inputs: [{ id: 'data', name: 'data', label: '数据', dataType: 'any' }],
      outputs: [{ id: 'data', name: 'data', label: '数据', dataType: 'any' }],
    },
  },
  {
    type: 'image',
    label: '图片显示',
    icon: '🖼️',
    category: 'Output',
    colorScheme: 'teal',
    description: '显示图片',
    defaultData: {
      nodeType: 'image',
      label: '图片显示',
      category: 'Output',
      inputs: [{ id: 'data', name: 'data', label: '图片URL', dataType: 'string' }],
      outputs: [{ id: 'data', name: 'data', label: '图片URL', dataType: 'string' }],
    },
  },
  {
    type: 'readFile',
    label: '读取文件',
    icon: '📄',
    category: 'File',
    colorScheme: 'orange',
    description: '从工作区读取文件',
    defaultData: {
      nodeType: 'readFile',
      label: '读取文件',
      category: 'File',
      filePath: 'data/input.txt',
      encoding: 'utf-8',
      errorIfNotFound: true,
      inputs: [{ id: 'path', name: 'path', label: '路径', dataType: 'string' }],
      outputs: [
        { id: 'content', name: 'content', label: '内容', dataType: 'string' },
        { id: 'exists', name: 'exists', label: '存在', dataType: 'boolean' },
      ],
    },
  },
  {
    type: 'writeFile',
    label: '写入文件',
    icon: '💾',
    category: 'File',
    colorScheme: 'orange',
    description: '写入文件到工作区',
    defaultData: {
      nodeType: 'writeFile',
      label: '写入文件',
      category: 'File',
      filePath: 'data/output.txt',
      writeMode: 'overwrite',
      contentSource: 'input',
      directContent: '',
      inputs: [{ id: 'content', name: 'content', label: '内容', dataType: 'string' }],
      outputs: [
        { id: 'success', name: 'success', label: '成功', dataType: 'boolean' },
        { id: 'path', name: 'path', label: '路径', dataType: 'string' },
      ],
    },
  },
  {
    type: 'executeCommand',
    label: '执行命令',
    icon: '⚡',
    category: 'System',
    colorScheme: 'red',
    description: '执行 Shell 命令',
    defaultData: {
      nodeType: 'executeCommand',
      label: '执行命令',
      category: 'System',
      command: '',
      cwd: '',
      timeout: 30000,
      continueOnError: false,
      inputs: [{ id: 'command', name: 'command', label: '命令', dataType: 'string' }],
      outputs: [
        { id: 'stdout', name: 'stdout', label: '标准输出', dataType: 'string' },
        { id: 'stderr', name: 'stderr', label: '标准错误', dataType: 'string' },
        { id: 'exitCode', name: 'exitCode', label: '退出码', dataType: 'number' },
      ],
    },
  },
  {
    type: 'reactAgent',
    label: 'ReAct 智能体',
    icon: '🧠',
    category: 'AI',
    colorScheme: 'purple',
    description: '推理与行动的 AI 智能体，支持多工具协作',
    defaultData: {
      nodeType: 'reactAgent',
      label: 'ReAct 智能体',
      category: 'AI',
      model: 'glm-4.7-flash:latest',
      systemPrompt: '你是一个善于分析和执行任务的智能助手。',
      userMessage: '{{input}}',
      temperature: 0.7,
      maxTokens: 4096,
      maxIterations: 10,
      enabledTools: ['executeCommand', 'readFile'],
      stream: true,
      inputs: [{ id: 'input', name: 'input', label: '输入', dataType: 'string' }],
      outputs: [{ id: 'response', name: 'response', label: '最终回答', dataType: 'string' }],
    },
  },
]
