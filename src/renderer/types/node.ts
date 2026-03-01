import { Node } from '@xyflow/react'
import type { NodeIconType } from '@/components/icons'

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
  | 'smartRouter'
  | 'output'
  | 'image'
  | 'readFile'
  | 'writeFile'
  | 'executeCommand'
  | 'reactAgent'
  | 'queue'
  | 'splitter'
  | 'join'

// ReAct Agent Tool Definition
// Browser tool types
export type BrowserToolType =
  | 'browser_navigate'
  | 'browser_click'
  | 'browser_type'
  | 'browser_scroll'
  | 'browser_screenshot'
  | 'browser_getContent'
  | 'browser_evaluate'
  | 'browser_wait'

export interface ToolDefinition {
  id: string
  name: string
  description: string
  type: 'readFile' | 'writeFile' | 'executeCommand' | 'httpRequest' | 'todos' | 'getCurrentDate' | BrowserToolType
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
  {
    id: 'getCurrentDate',
    name: 'getCurrentDate',
    label: '获取日期',
    description: '获取当前日期和时间。输入可选: {"format": "full|date|time|timestamp"}。full=完整日期时间, date=仅日期, time=仅时间, timestamp=Unix时间戳',
    type: 'getCurrentDate' as const,
    builtIn: true,
  },
  // Browser automation tools
  {
    id: 'browser_navigate',
    name: 'browser_navigate',
    label: '浏览器导航',
    description: '导航到指定URL。输入: {"url": "https://example.com"}',
    type: 'browser_navigate' as const,
    builtIn: false,
    category: 'browser',
  },
  {
    id: 'browser_click',
    name: 'browser_click',
    label: '浏览器点击',
    description: '点击页面元素。输入: {"selector": "button.submit"} 或 {"selector": "#login-btn"}',
    type: 'browser_click' as const,
    builtIn: false,
    category: 'browser',
  },
  {
    id: 'browser_type',
    name: 'browser_type',
    label: '浏览器输入',
    description: '在输入框中输入文本。输入: {"selector": "input[name=q]", "text": "搜索内容", "clear": true}',
    type: 'browser_type' as const,
    builtIn: false,
    category: 'browser',
  },
  {
    id: 'browser_scroll',
    name: 'browser_scroll',
    label: '浏览器滚动',
    description: '滚动页面。输入: {"direction": "down", "amount": 500}。direction可选: up, down',
    type: 'browser_scroll' as const,
    builtIn: false,
    category: 'browser',
  },
  {
    id: 'browser_screenshot',
    name: 'browser_screenshot',
    label: '浏览器截图',
    description: '截取页面截图。输入: {"fullPage": true} 或 {"selector": ".main-content"}',
    type: 'browser_screenshot' as const,
    builtIn: false,
    category: 'browser',
  },
  {
    id: 'browser_getContent',
    name: 'browser_getContent',
    label: '获取页面内容',
    description: '获取页面文本或HTML内容。输入: {"format": "text"} 或 {"format": "html", "selector": ".article", "maxLength": 5000}',
    type: 'browser_getContent' as const,
    builtIn: false,
    category: 'browser',
  },
  {
    id: 'browser_evaluate',
    name: 'browser_evaluate',
    label: '执行JavaScript',
    description: '在页面中执行JavaScript代码。输入: {"script": "document.title"} 或复杂脚本',
    type: 'browser_evaluate' as const,
    builtIn: false,
    category: 'browser',
  },
  {
    id: 'browser_wait',
    name: 'browser_wait',
    label: '浏览器等待',
    description: '等待元素出现或指定时间。输入: {"selector": ".loading", "timeout": 5000}',
    type: 'browser_wait' as const,
    builtIn: false,
    category: 'browser',
  },
] as const

export type AvailableToolId = (typeof AVAILABLE_TOOLS)[number]['id']

// Node status
export type NodeStatus = 'idle' | 'running' | 'success' | 'error'

// Debug Mode Configuration for OpenAI API
export interface DebugModeConfig {
  enabled: boolean
  apiEndpoint: string  // e.g., "https://api.openai.com/v1"
  apiKey: string       // Runtime only, not persisted to workflow
  model: string        // e.g., "gpt-4o"
}

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
  debugMode?: DebugModeConfig
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

// Smart Router Branch
export interface SmartRouterBranch {
  id: string
  name: string
  description: string
  isDefault: boolean
}

// Smart Router Node
export interface SmartRouterNodeData extends BaseNodeData {
  nodeType: 'smartRouter'
  branches: SmartRouterBranch[]
  model: string
  routingPrompt: string
  temperature: number
  debugMode?: DebugModeConfig
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
  sourceType: 'input' | 'variable'  // 输入值或变量
  variableName?: string  // 当 sourceType 为 'variable' 时的变量名
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
  debugMode?: DebugModeConfig
}

// Queue Node - collects multiple inputs into an array
export interface QueueNodeData extends BaseNodeData {
  nodeType: 'queue'
  inputCount: number
}

// Splitter Node - distributes one input to multiple outputs
export interface SplitterNodeData extends BaseNodeData {
  nodeType: 'splitter'
  outputCount: number
  failureStrategy: 'continueOthers' | 'failAll'
}

// Join Node - collects multiple parallel branch outputs
export interface JoinNodeData extends BaseNodeData {
  nodeType: 'join'
  inputCount: number
}

// Union type for all node data
export type WorkflowNodeData =
  | InputNodeData
  | OllamaChatNodeData
  | SetNodeData
  | IfNodeData
  | LoopNodeData
  | SmartRouterNodeData
  | OutputNodeData
  | ImageNodeData
  | ReadFileNodeData
  | WriteFileNodeData
  | ExecuteCommandNodeData
  | ReactAgentNodeData
  | QueueNodeData
  | SplitterNodeData
  | JoinNodeData

// Workflow node type
export type WorkflowNode = Node<WorkflowNodeData>

// Node templates for creating new nodes
export interface NodeTemplate {
  type: NodeType
  label: string
  icon: NodeIconType
  category: string
  description: string
  defaultData: Partial<WorkflowNodeData>
  colorScheme?: 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'cyan' | 'teal' | 'yellow'
}

export const nodeTemplates: NodeTemplate[] = [
  {
    type: 'input',
    label: '输入',
    icon: 'input',
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
    icon: 'ollamaChat',
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
    icon: 'set',
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
    icon: 'if',
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
    icon: 'loop',
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
    type: 'smartRouter',
    label: '智能路由',
    icon: 'smartRouter',
    category: 'Logic',
    colorScheme: 'blue',
    description: '使用 AI 智能路由到不同分支',
    defaultData: {
      nodeType: 'smartRouter',
      label: '智能路由',
      category: 'Logic',
      branches: [
        {
          id: 'branch-1',
          name: '技术问题',
          description: '处理技术相关的询问、bug 报告、功能需求等',
          isDefault: false,
        },
        {
          id: 'branch-2',
          name: '商务咨询',
          description: '处理商务合作、价格咨询、合同洽谈等',
          isDefault: false,
        },
        {
          id: 'branch-3',
          name: '其他',
          description: '无法分类到上述分支的其他问题',
          isDefault: true,
        },
      ],
      model: 'glm-4.7-flash:latest',
      routingPrompt: '根据输入内容，选择最合适的分支。',
      temperature: 0.3,
      inputs: [{ id: 'input', name: 'input', label: '输入', dataType: 'any' }],
      outputs: [
        { id: 'branch-1', name: 'branch-1', label: '技术问题', dataType: 'any' },
        { id: 'branch-2', name: 'branch-2', label: '商务咨询', dataType: 'any' },
        { id: 'branch-3', name: 'branch-3', label: '其他', dataType: 'any' },
      ],
    },
  },
  {
    type: 'output',
    label: '输出',
    icon: 'output',
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
    icon: 'image',
    category: 'Output',
    colorScheme: 'teal',
    description: '显示图片',
    defaultData: {
      nodeType: 'image',
      label: '图片显示',
      category: 'Output',
      sourceType: 'input',
      inputs: [{ id: 'data', name: 'data', label: '图片URL', dataType: 'string' }],
      outputs: [{ id: 'data', name: 'data', label: '图片URL', dataType: 'string' }],
    },
  },
  {
    type: 'readFile',
    label: '读取文件',
    icon: 'readFile',
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
    icon: 'writeFile',
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
    icon: 'executeCommand',
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
    icon: 'reactAgent',
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
  {
    type: 'queue',
    label: '队列',
    icon: 'queue',
    category: 'Logic',
    colorScheme: 'blue',
    description: '接收多路输入入队，有元素时立即出队透传',
    defaultData: {
      nodeType: 'queue',
      label: '队列',
      category: 'Logic',
      inputCount: 2,
      inputs: [
        { id: 'input1', name: 'input1', label: '输入1', dataType: 'any' },
        { id: 'input2', name: 'input2', label: '输入2', dataType: 'any' },
      ],
      outputs: [{ id: 'output', name: 'output', label: '输出', dataType: 'any' }],
    },
  },
  {
    type: 'splitter',
    label: '分发',
    icon: 'splitter',
    category: 'Logic',
    colorScheme: 'blue',
    description: '将一路输入同时分发给多个输出（并行执行）',
    defaultData: {
      nodeType: 'splitter',
      label: '分发',
      category: 'Logic',
      outputCount: 2,
      failureStrategy: 'continueOthers',
      inputs: [{ id: 'input', name: 'input', label: '输入', dataType: 'any' }],
      outputs: [
        { id: 'output1', name: 'output1', label: '输出1', dataType: 'any' },
        { id: 'output2', name: 'output2', label: '输出2', dataType: 'any' },
      ],
    },
  },
  {
    type: 'join',
    label: '汇聚',
    icon: 'join',
    category: 'Logic',
    colorScheme: 'blue',
    description: '收集多个并行分支的输出，等待所有分支完成后继续',
    defaultData: {
      nodeType: 'join',
      label: '汇聚',
      category: 'Logic',
      inputCount: 2,
      inputs: [
        { id: 'input1', name: 'input1', label: '输入1', dataType: 'any' },
        { id: 'input2', name: 'input2', label: '输入2', dataType: 'any' },
      ],
      outputs: [{ id: 'output', name: 'output', label: '输出', dataType: 'object' }],
    },
  },
]
