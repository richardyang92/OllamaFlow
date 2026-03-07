/**
 * 工具依赖分析器
 * 分析工具调用之间的依赖关系，确定哪些可以并行执行
 */

/**
 * 工具调用信息（与 OpenAIToolCall 兼容）
 */
export interface ToolCallInfo {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

/**
 * 带索引的工具调用分组
 */
export interface ToolCallWithIndex {
  toolCall: ToolCallInfo
  index: number
}

/**
 * 工具调用内部信息（用于依赖分析）
 */
interface ToolCallAnalysisInfo {
  toolCall: ToolCallInfo
  index: number
  name: string
  args: Record<string, unknown>
  fileRefs: string[]
  dependsOn: Set<number>
}

/**
 * 解析工具调用参数
 */
function parseToolCallArgs(argsString: string): Record<string, unknown> {
  if (!argsString) return {}
  try {
    return JSON.parse(argsString)
  } catch {
    return {}
  }
}

/**
 * 从工具参数中提取文件引用
 */
function getFileReferences(toolName: string, args: Record<string, unknown>): string[] {
  const refs: string[] = []
  const lowerName = toolName.toLowerCase()

  if (lowerName === 'writefile' || lowerName === 'readfile') {
    if (args.filename) refs.push(String(args.filename).toLowerCase())
    if (args.filePath) refs.push(String(args.filePath).toLowerCase())
  } else if (lowerName === 'executecommand') {
    // 从命令中提取潜在文件引用
    const command = String(args.command || '')
    // 匹配常见模式如 "python script.py" 或 "node app.js"
    const fileMatches = command.match(/\b(\w+\.(py|js|ts|sh|json|txt|md))\b/gi)
    if (fileMatches) refs.push(...fileMatches.map(f => f.toLowerCase()))
  }

  return refs
}

/**
 * 分析工具调用依赖关系，返回可并行执行的分组
 *
 * 依赖规则：
 * 1. readFile 总是依赖之前的操作（因为结果可能被使用）
 * 2. executeCommand 如果操作同一文件，依赖 writeFile
 * 3. 多个 writeFile 到同一文件需要串行
 * 4. todos 操作需要串行（状态管理）
 * 5. workflow_* (SubAgent) 之间无依赖，可并行
 * 6. 其他内置工具（listFiles、getCurrentDate 等）可并行
 *
 * @param toolCalls 工具调用列表
 * @returns 分组后的工具调用（每组内的工具可并行执行）
 */
export function analyzeToolDependencies(toolCalls: ToolCallInfo[]): ToolCallWithIndex[][] {
  if (toolCalls.length <= 1) {
    return toolCalls.map((tc, i) => [{ toolCall: tc, index: i }])
  }

  // 解析工具调用信息
  const toolCallInfos: ToolCallAnalysisInfo[] = toolCalls.map((tc, i) => {
    const args = parseToolCallArgs(tc.function.arguments)
    return {
      toolCall: tc,
      index: i,
      name: tc.function.name.toLowerCase(),
      args,
      fileRefs: getFileReferences(tc.function.name, args),
      dependsOn: new Set<number>(),
    }
  })

  // 分析依赖关系

  // 分析依赖关系
  for (let i = 0; i < toolCallInfos.length; i++) {
    for (let j = 0; j < i; j++) {
      const current = toolCallInfos[i]
      const previous = toolCallInfos[j]

      // 规则 1: readFile 总是依赖之前的操作（结果可能被使用）
      // 但如果是 workflow_* 之前的操作，不需要依赖（它们是独立的）
      if (current.name === 'readfile' && !previous.name.startsWith('workflow_')) {
        current.dependsOn.add(j)
        continue
      }

      // 规则 2: executeCommand 如果操作同一文件，依赖 writeFile
      if (current.name === 'executecommand' && previous.name === 'writefile') {
        const execFiles = current.fileRefs
        const writeFile = previous.args.filename || previous.args.filePath
        if (writeFile && execFiles.some(f => f.includes(String(writeFile).toLowerCase()))) {
          current.dependsOn.add(j)
        }
      }

      // 规则 3: writeFile 到同一文件需要串行（后写的覆盖先写的）
      if (current.name === 'writefile' && previous.name === 'writefile') {
        const currentFile = String(current.args.filename || current.args.filePath).toLowerCase()
        const previousFile = String(previous.args.filename || previous.args.filePath).toLowerCase()
        if (currentFile === previousFile) {
          current.dependsOn.add(j)
        }
      }

      // 规则 4: todos 操作需要串行（状态管理）
      if (current.name === 'todos' && previous.name === 'todos') {
        current.dependsOn.add(j)
      }
    }
  }

  // 按依赖层级分组（拓扑排序）
  const groups: ToolCallWithIndex[][] = []
  const assigned = new Set<number>()

  while (assigned.size < toolCallInfos.length) {
    const group: ToolCallWithIndex[] = []

    for (const info of toolCallInfos) {
      if (assigned.has(info.index)) continue

      // 检查所有依赖是否都已满足
      const depsSatisfied = Array.from(info.dependsOn).every(dep => assigned.has(dep))
      if (depsSatisfied) {
        group.push({ toolCall: info.toolCall, index: info.index })
      }
    }

    if (group.length === 0) {
      // 循环依赖或 bug，按顺序添加剩余项
      for (const info of toolCallInfos) {
        if (!assigned.has(info.index)) {
          group.push({ toolCall: info.toolCall, index: info.index })
          break
        }
      }
    }

    for (const item of group) {
      assigned.add(item.index)
    }
    groups.push(group)
  }

  return groups
}

/**
 * 判断工具是否可以并行执行
 * @param toolName 工具名称
 * @returns 是否可并行
 */
export function isToolParallelSafe(toolName: string): boolean {
  const lowerName = toolName.toLowerCase()

  // 可并行的工具：
  // - 文件读取（I/O 密集型）
  // - 文件列表
  // - HTTP 请求
  // - SubAgent 调用
  // - 获取日期等无状态操作

  const parallelSafeTools = [
    'readfile',
    'listfiles',
    'httprequest',
    'getcurrentdate',
  ]

  // workflow_* 工具可并行
  if (lowerName.startsWith('workflow_')) {
    return true
  }

  return parallelSafeTools.includes(lowerName)
}

/**
 * 判断工具是否必须串行执行
 * @param toolName 工具名称
 * @returns 是否必须串行
 */
export function isToolSequential(toolName: string): boolean {
  const lowerName = toolName.toLowerCase()

  // 必须串行的工具：
  // - todos（状态管理）
  // - writeFile（可能有文件冲突）
  // - executeCommand（可能有副作用）

  const sequentialTools = [
    'todos',
  ]

  return sequentialTools.includes(lowerName)
}
