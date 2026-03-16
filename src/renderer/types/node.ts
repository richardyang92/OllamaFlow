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
  | 'plan'
  | 'queue'
  | 'splitter'
  | 'join'
  | 'httpRequest'
  | 'delay'
  | 'json'

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

// Math tool types
export type MathToolType =
  | 'math_calculate'
  | 'math_statistics'
  | 'math_number_theory'
  | 'math_linear_algebra'
  | 'math_unit_convert'
  | 'math_probability'
  | 'math_calculus'
  | 'math_equation'

export interface ToolDefinition {
  id: string
  name: string
  description: string
  type: 'readFile' | 'writeFile' | 'executeCommand' | 'httpRequest' | 'todos' | 'getCurrentDate' | 'writeMultipleFiles' | 'executePython' | 'webSearch' | 'fetchUrl' | MathToolType | BrowserToolType
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
    description: '任务规划与跟踪工具。建议接到任务后首先使用 init 创建任务列表: {"action": "init", "tasks": ["步骤1", "步骤2", ...]}。可帮助跟踪进度、避免遗漏步骤、让执行更有条理。',
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
    id: 'writeMultipleFiles',
    name: 'writeMultipleFiles',
    label: '批量写文件',
    description: '一次性写入多个文件。输入: {"files": [{"filename": "file1.py", "content": "..."}, {"filename": "file2.py", "content": "..."}]}。适合需要创建多个相关文件的场景',
    type: 'writeMultipleFiles' as const,
    builtIn: false,
  },
  {
    id: 'executePython',
    name: 'executePython',
    label: '执行Python代码',
    description: '直接执行 Python 代码，无需先写入文件。输入: {"code": "print(1+1)"}。可选参数: {"saveAs": "script.py"} 保存代码到文件',
    type: 'executePython' as const,
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
  {
    id: 'webSearch',
    name: 'webSearch',
    label: '网页搜索',
    description: '通过 SimpleXNG 搜索引擎搜索网页内容。输入: {"query": "搜索关键词", "maxResults": 5}。maxResults可选，默认5条结果',
    type: 'webSearch' as const,
    builtIn: false,
  },
  {
    id: 'fetchUrl',
    name: 'fetchUrl',
    label: '获取网页',
    description: '获取并解析网页内容，返回干净的 Markdown 格式文本（自动过滤广告和导航）。输入: {"url": "https://example.com", "maxContentLength": 5000}',
    type: 'fetchUrl' as const,
    builtIn: false,
  },
  // Mathematics tools
  {
    id: 'math_calculate',
    name: 'math_calculate',
    label: '数学计算',
    description: '执行数学计算。支持基础运算(+,-,*,/,%,**)、平方根(sqrt)、幂运算(^)、三角函数(sin/cos/tan)、对数(log/ln)、阶乘(!)、组合数(C(n,k)或comb(n,k))、排列数(P(n,k)或perm(n,k))等。输入: {"expression": "sqrt(2) + 1", "precision": 4, "outputFormat": "auto"}。outputFormat可选: auto(自动)/decimal(小数)/fraction(分数)/percent(百分比)',
    type: 'math_calculate' as const,
    builtIn: false,
    category: 'math',
  },
  {
    id: 'math_statistics',
    name: 'math_statistics',
    label: '统计分析',
    description: '计算数组的统计量。支持平均值(mean)、中位数(median)、众数(mode)、方差(variance)、标准差(stddev)、求和(sum)、最大值(max)、最小值(min)、极差(range)、计数(count)。输入: {"data": [1,2,3,4,5], "operations": ["mean", "median", "stddev"]}',
    type: 'math_statistics' as const,
    builtIn: false,
    category: 'math',
  },
  {
    id: 'math_number_theory',
    name: 'math_number_theory',
    label: '数论计算',
    description: '数论相关计算。支持操作: is_prime(素数检测)、prime_factors(质因数分解)、prime_sieve(素数筛)、next_prime(下一个素数)、prev_prime(上一个素数)、gcd(最大公约数)、lcm(最小公倍数)、mod_exp(模幂运算)、mod_inverse(模逆元)、fibonacci(斐波那契数)、factorial(阶乘)、permutations(排列数P(n,k))、combinations(组合数C(n,k))、digit_sum(数位和)、is_perfect(完全数检测)、divisors(所有因子)、totient(欧拉函数)、is_coprime(互质检测)、catalan(卡特兰数)。输入示例: {"operation": "prime_factors", "number": 60}',
    type: 'math_number_theory' as const,
    builtIn: false,
    category: 'math',
  },
  {
    id: 'math_linear_algebra',
    name: 'math_linear_algebra',
    label: '线性代数',
    description: '矩阵和向量运算。支持操作: add(矩阵加法)、subtract(矩阵减法)、multiply(矩阵乘法)、transpose(转置)、determinant/det(行列式)、inverse/inv(逆矩阵)、eigenvalues(特征值)、eigenvectors(特征向量)、eigs(完整特征分解)、rank(秩)、norm(范数)、dot(向量点积)、cross(向量叉积)、trace(迹)、lu(LU分解)、qr(QR分解)、solve_linear(解线性方程组)、identity(单位矩阵)、zeros(零矩阵)、ones(全1矩阵)、size(矩阵维度)。输入示例: {"operation": "multiply", "matrixA": [[1,2],[3,4]], "matrixB": [[5,6],[7,8]]}',
    type: 'math_linear_algebra' as const,
    builtIn: false,
    category: 'math',
  },
  {
    id: 'math_unit_convert',
    name: 'math_unit_convert',
    label: '单位转换',
    description: '物理单位转换。支持: 长度(m/km/mile/ft/in等)、质量(kg/g/lb/oz等)、时间(s/min/h/day/year等)、温度(C/F/K)、面积(m²/km²/acre等)、体积(L/gal/m³等)、速度(m/s/km/h/mph等)、压力(Pa/bar/psi/atm等)、能量(J/cal/kWh/BTU等)、功率(W/kW/hp等)、数据(B/KB/MB/GB/TB等)、角度(deg/rad等)。输入: {"value": 100, "from": "km", "to": "mile"}',
    type: 'math_unit_convert' as const,
    builtIn: false,
    category: 'math',
  },
  {
    id: 'math_probability',
    name: 'math_probability',
    label: '概率统计',
    description: '概率分布和统计分析。支持操作: normal_pdf(正态分布PDF)、normal_cdf(正态分布CDF)、normal_quantile(正态分位数)、binomial_pmf(二项分布PMF)、binomial_cdf(二项分布CDF)、poisson_pmf(泊松分布PMF)、poisson_cdf(泊松分布CDF)、exponential_pdf(指数分布PDF)、exponential_cdf(指数分布CDF)、correlation(相关系数)、covariance(协方差)、linear_regression(线性回归)、describe(描述性统计)、quantile(分位数)、skewness(偏度)、kurtosis(峰度)。输入示例: {"operation": "normal_cdf", "x": 1.96, "mean": 0, "stddev": 1}',
    type: 'math_probability' as const,
    builtIn: false,
    category: 'math',
  },
  {
    id: 'math_calculus',
    name: 'math_calculus',
    label: '微积分',
    description: '微积分运算。支持操作: derivative(符号求导)、evaluate_derivative(求导数值)、integral(不定积分提示)、evaluate_integral(定积分数值计算)、limit(极限)、simplify(化简)、expand(展开)、factor(因式分解)、taylor(泰勒展开)、nth_derivative(n阶导数)。输入示例: {"operation": "derivative", "expression": "x^2 + 2*x + 1", "variable": "x"}',
    type: 'math_calculus' as const,
    builtIn: false,
    category: 'math',
  },
  {
    id: 'math_equation',
    name: 'math_equation',
    label: '方程求解',
    description: '方程和方程组求解。支持操作: solve(符号方程求解)、solve_linear(线性方程组矩阵求解)、roots(多项式求根)、numeric_solve(数值求解)、inequality(不等式化简)、system(方程组求解)。输入示例: {"operation": "solve", "equation": "x^2 - 5*x + 6 = 0", "variable": "x"}，或 {"operation": "solve_linear", "matrixA": [[2,1],[1,3]], "vectorB": [5,7]}',
    type: 'math_equation' as const,
    builtIn: false,
    category: 'math',
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
  maxIterations?: number  // 最大迭代次数（用于显示 X/XX 格式）
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

// Plan Node Question Types
export type PlanQuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'boolean'

// Plan Node Question
export interface PlanQuestion {
  id: string
  question: string
  type: PlanQuestionType
  options?: string[]  // for select/multiselect
  required: boolean
  placeholder?: string
  defaultValue?: string
}

// Plan Node Phase
export type PlanPhase = 'analyzing' | 'questions' | 'generating' | 'complete' | 'error'

// Plan Node Execution State
export interface PlanExecutionState {
  nodeId: string
  phase: PlanPhase
  questions?: PlanQuestion[]
  answers?: Record<string, string>
  analysisResult?: string
  generatedPlan?: string
  error?: string
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

// Debug mode configuration for ReAct Agent and Plan nodes
export interface DebugModeConfig {
  enabled: boolean
  model: string
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
  enableUserInput?: boolean
  debugMode?: DebugModeConfig
}

// Plan Node
export interface PlanNodeData extends BaseNodeData {
  nodeType: 'plan'
  model: string
  systemPrompt: string
  temperature: number
  maxTokens: number
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

// HTTP Request Node
export interface HttpRequestNodeData extends BaseNodeData {
  nodeType: 'httpRequest'
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  headers: Record<string, string>
  queryParams: Record<string, string>
  bodyType: 'none' | 'json' | 'text' | 'form'
  body: string
  timeout: number
  responseType: 'json' | 'text'
}

// Delay Node
export interface DelayNodeData extends BaseNodeData {
  nodeType: 'delay'
  delayMs: number
  passthrough: boolean
}

// JSON Node
export type JsonNodeMode = 'parse' | 'stringify' | 'extract' | 'merge'

export interface JsonNodeData extends BaseNodeData {
  nodeType: 'json'
  mode: JsonNodeMode
  jsonPath: string  // for extract mode
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
  | PlanNodeData
  | QueueNodeData
  | SplitterNodeData
  | JoinNodeData
  | HttpRequestNodeData
  | DelayNodeData
  | JsonNodeData

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
      model: '',
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
      model: '',
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
      model: '',
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
    type: 'plan',
    label: '智能规划',
    icon: 'plan',
    category: 'AI',
    colorScheme: 'purple',
    description: '智能分析任务并生成执行计划，如有需要会向用户提问',
    defaultData: {
      nodeType: 'plan',
      label: '智能规划',
      category: 'AI',
      model: '',
      systemPrompt: '你是一个专业的任务规划助手。根据用户的任务描述，分析任务需求，如果信息不足则提出相关问题，最后生成详细的执行计划。',
      temperature: 0.7,
      maxTokens: 4096,
      inputs: [{ id: 'task', name: 'task', label: '任务描述', dataType: 'string' }],
      outputs: [
        { id: 'plan', name: 'plan', label: '执行计划', dataType: 'string' },
        { id: 'hadQuestions', name: 'hadQuestions', label: '是否有提问', dataType: 'boolean' },
      ],
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
  {
    type: 'httpRequest',
    label: 'HTTP 请求',
    icon: 'httpRequest',
    category: 'Data',
    colorScheme: 'green',
    description: '发送 HTTP 请求调用外部 API',
    defaultData: {
      nodeType: 'httpRequest',
      label: 'HTTP 请求',
      category: 'Data',
      method: 'GET',
      url: '',
      headers: {},
      queryParams: {},
      bodyType: 'none',
      body: '',
      timeout: 30000,
      responseType: 'json',
      inputs: [{ id: 'input', name: 'input', label: '输入', dataType: 'any' }],
      outputs: [
        { id: 'response', name: 'response', label: '响应', dataType: 'any' },
        { id: 'status', name: 'status', label: '状态码', dataType: 'number' },
      ],
    },
  },
  {
    type: 'delay',
    label: '延迟',
    icon: 'delay',
    category: 'Logic',
    colorScheme: 'blue',
    description: '暂停执行指定时间',
    defaultData: {
      nodeType: 'delay',
      label: '延迟',
      category: 'Logic',
      delayMs: 1000,
      passthrough: true,
      inputs: [{ id: 'input', name: 'input', label: '输入', dataType: 'any' }],
      outputs: [{ id: 'output', name: 'output', label: '输出', dataType: 'any' }],
    },
  },
  {
    type: 'json',
    label: 'JSON 处理',
    icon: 'json',
    category: 'Data',
    colorScheme: 'yellow',
    description: 'JSON 解析、提取、转换',
    defaultData: {
      nodeType: 'json',
      label: 'JSON 处理',
      category: 'Data',
      mode: 'parse',
      jsonPath: '',
      inputs: [{ id: 'input', name: 'input', label: '输入', dataType: 'any' }],
      outputs: [{ id: 'output', name: 'output', label: '输出', dataType: 'any' }],
    },
  },
]
