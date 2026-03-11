/**
 * 工作流执行器 - 用于智能Agent调用工作流作为SubAgent
 */

import type { Node, Edge } from '@xyflow/react'
import type { WorkflowNodeData, ReActStep } from '@/types/node'
import type { GeneratedFileInfo, ReActStepDetail } from '@/store/agent-store'
import { useExecutionStore } from '@/store/execution-store'
import { takeFileSnapshot, compareSnapshots } from './file-snapshot'

const DEBUG = false
const log = (...args: unknown[]) => DEBUG && console.log('[WorkflowExecutor]', ...args)

// 进度回调类型
export interface SubAgentProgressCallback {
  onStatusChange: (status: 'loading' | 'running' | 'completed' | 'error') => void
  onNodeStart: (nodeName: string, nodeId: string) => void
  onNodeComplete: (nodeName: string, nodeId: string, success: boolean) => void
  onProgress: (completedNodes: number, totalNodes: number) => void
  onLog: (message: string) => void
  // ReAct Agent 状态更新回调
  onReactAgentUpdate?: (
    nodeId: string,
    nodeName: string,
    detail: {
      currentIteration: number
      maxIterations: number
      steps: ReActStep[]           // 所有步骤（新增）
      currentStep?: ReActStep
      totalSteps: number
    }
  ) => void
  // Ollama Chat 节点状态更新回调
  onOllamaChatUpdate?: (
    nodeId: string,
    nodeName: string,
    detail: {
      model: string
      reasoningContent?: string
      reasoningStreaming?: boolean
      responseContent?: string
      responseStreaming?: boolean
    }
  ) => void
  // 节点步骤回调（新增）- 将工作流节点执行作为步骤发送
  onNodeStep?: (step: {
    id: string
    nodeId: string
    nodeName: string
    nodeType: string
    status: 'pending' | 'running' | 'completed' | 'error'
    startTime: number
    endTime?: number
    thought?: string
    thoughtStreaming?: boolean
    observation?: string
    observationStreaming?: boolean
    observationError?: boolean
    reactAgentSteps?: ReActStepDetail[]
    error?: string
  }) => void
  // 节点步骤更新回调（新增）
  onNodeStepUpdate?: (nodeId: string, update: {
    thought?: string
    observation?: string
    reactAgentSteps?: ReActStepDetail[]
  }) => void
}

// 工作流执行结果
export interface WorkflowExecutionResult {
  success: boolean
  output: unknown
  error?: string
  logs: string[]
  totalNodes?: number  // 总节点数
  generatedFiles?: GeneratedFileInfo[]  // 生成的文件列表
}

/**
 * 执行指定工作区的工作流
 */
export async function executeWorkflowAsSubAgent(
  workspacePath: string,
  inputValues: Record<string, unknown>,
  options?: {
    apiEndpoint?: string
    apiKey?: string
    onLog?: (message: string) => void
    // 进度回调
    onProgress?: SubAgentProgressCallback
  }
): Promise<WorkflowExecutionResult> {
  const logs: string[] = []
  const addLog = (msg: string) => {
    logs.push(msg)
    options?.onLog?.(msg)
    options?.onProgress?.onLog(msg)
    log(msg)
  }

  try {
    addLog(`加载工作流: ${workspacePath}`)
    addLog(`输入参数: ${JSON.stringify(inputValues)}`)

    // 加载工作流数据
    const workflowData = await window.electronAPI.workflow.loadData(workspacePath)
    if (!workflowData) {
      return {
        success: false,
        output: null,
        error: '无法加载工作流数据',
        logs,
      }
    }

    // 加载工作区配置
    const config = await window.electronAPI.workspace.readConfig(workspacePath)
    if (!config) {
      return {
        success: false,
        output: null,
        error: '无法加载工作区配置',
        logs,
      }
    }

    const nodes = workflowData.nodes as Node<WorkflowNodeData>[]
    const edges = workflowData.edges as Edge[]

    if (!nodes || nodes.length === 0) {
      return {
        success: false,
        output: null,
        error: '工作流没有节点',
        logs,
      }
    }

    addLog(`工作流包含 ${nodes.length} 个节点, ${edges.length} 条边`)

    // 动态导入执行器（避免循环依赖）
    const { WorkflowExecutor } = await import('../executor')

    // 找到输入节点并映射输入值到节点 ID
    // Input 节点执行器通过 context.userInputValues.get(node.id) 获取值
    const inputNodes = nodes.filter((n) => n.type === 'input')
    const nodeInputValues: Record<string, string> = {} // 键是节点 ID

    addLog(`找到 ${inputNodes.length} 个输入节点`)
    addLog(`inputValues 键: ${Object.keys(inputValues).join(', ')}`)

    if (inputNodes.length > 0 && Object.keys(inputValues).length > 0) {
      for (const inputNode of inputNodes) {
        const nodeLabel = (inputNode.data.label as string) || 'input'
        let matchedValue: string | undefined

        addLog(`处理输入节点: id=${inputNode.id}, label=${nodeLabel}`)

        // 优先尝试匹配节点标签
        if (inputValues[nodeLabel] !== undefined) {
          matchedValue = typeof inputValues[nodeLabel] === 'string'
            ? inputValues[nodeLabel] as string
            : JSON.stringify(inputValues[nodeLabel])
          addLog(`匹配输入节点 "${nodeLabel}": ${matchedValue}`)
        }
        // 然后尝试匹配 'input' 键（最常用的默认键）
        else if (inputValues.input !== undefined) {
          matchedValue = typeof inputValues.input === 'string'
            ? inputValues.input as string
            : JSON.stringify(inputValues.input)
          addLog(`使用默认输入值 (input): ${matchedValue}`)
        }
        // 最后尝试使用第一个可用的值
        else {
          const firstKey = Object.keys(inputValues)[0]
          if (firstKey && inputValues[firstKey] !== undefined) {
            matchedValue = typeof inputValues[firstKey] === 'string'
              ? inputValues[firstKey] as string
              : JSON.stringify(inputValues[firstKey])
            addLog(`使用第一个输入值 (${firstKey}): ${matchedValue}`)
          }
        }

        if (matchedValue !== undefined) {
          nodeInputValues[inputNode.id] = matchedValue
          addLog(`设置 nodeInputValues[${inputNode.id}] = ${matchedValue}`)
        } else {
          addLog(`警告: 未能为节点 ${nodeLabel} 匹配到输入值`)
        }
      }
    } else {
      addLog(`跳过输入映射: inputNodes=${inputNodes.length}, inputValues.keys=${Object.keys(inputValues).length}`)
    }

    addLog(`nodeInputValues 映射: ${JSON.stringify(nodeInputValues)}`)

    // 通知开始加载
    options?.onProgress?.onStatusChange('loading')

    // 获取执行前的文件快照
    addLog('获取执行前文件快照...')
    const beforeSnapshot = await takeFileSnapshot(workspacePath)
    addLog(`执行前快照: ${beforeSnapshot.files.size} 个文件`)

    // 创建执行上下文
    const executionStore = useExecutionStore.getState()
    const executionId = executionStore.createExecution(workspacePath, 'subagent')

    // 获取节点名称映射
    const nodeNameMap = new Map<string, string>()
    nodes.forEach((node) => {
      nodeNameMap.set(node.id, (node.data.label as string) || node.type || node.id)
    })

    // 计算需要执行的节点总数（排除 trigger 类型的节点，因为它们是自动触发的）
    const executableNodes = nodes.filter((n) => n.type !== 'trigger')
    const totalNodesCount = executableNodes.length
    const completedNodeIds = new Set<string>() // 跟踪已完成的节点
    const trackedNodeIds = new Set<string>() // 跟踪已发送开始事件的节点
    const nodeStartTimes = new Map<string, number>() // 记录节点开始时间

    // 通知开始执行，传递总节点数
    options?.onProgress?.onStatusChange('running')
    options?.onProgress?.onProgress(0, totalNodesCount)

    // 创建执行器，传递以节点 ID 为键的输入值映射
    const executor = new WorkflowExecutor(
      nodes,
      edges,
      workspacePath,
      executionId,
      options?.apiEndpoint || config.apiEndpoint || 'http://127.0.0.1:11434',
      nodeInputValues, // 键是节点 ID，值是输入值
      true, // isolatedMode
      options?.apiKey
    )

    addLog('开始执行工作流...')

    // 定期检查执行进度并回调
    const progressInterval = setInterval(() => {
      const currentExecution = executionStore.getExecution(executionId)
      if (!currentExecution?.context?.nodeResults) return

      // 计算已完成的节点数
      let runningNodeName: string | null = null
      let runningNodeId: string | null = null
      currentExecution.context.nodeResults.forEach((result, nodeId) => {
        const nodeName = nodeNameMap.get(nodeId) || nodeId
        const node = nodes.find(n => n.id === nodeId)
        const nodeType = node?.type || 'unknown'

        // 检查节点是否刚开始运行（发送节点步骤）
        if (result.status === 'running' && !trackedNodeIds.has(nodeId)) {
          trackedNodeIds.add(nodeId)
          nodeStartTimes.set(nodeId, Date.now())

          // 创建节点步骤
          const stepId = `nodestep_${Date.now()}_${nodeId}`
          const startTime = Date.now()

          options?.onProgress?.onNodeStep?.({
            id: stepId,
            nodeId,
            nodeName,
            nodeType,
            status: 'running',
            startTime,
            thought: typeof result.input === 'string' ? result.input : JSON.stringify(result.input),
          })

          runningNodeName = nodeName
          runningNodeId = nodeId
        }

        // 检查节点是否刚完成（更新节点步骤）
        if ((result.status === 'success' || result.status === 'error') && !completedNodeIds.has(nodeId)) {
          completedNodeIds.add(nodeId)
          const startTime = nodeStartTimes.get(nodeId) || Date.now()
          const endTime = Date.now()

          // 更新节点步骤为完成状态
          options?.onProgress?.onNodeStep?.({
            id: `nodestep_${nodeId}`,
            nodeId,
            nodeName,
            nodeType,
            status: result.status === 'success' ? 'completed' : 'error',
            startTime,
            endTime,
            observation: typeof result.output === 'string' ? result.output : JSON.stringify(result.output),
            error: result.error,
          })
        }

        // 检查正在运行的节点（用于流式更新）
        if (result.status === 'running') {
          runningNodeName = nodeName
          runningNodeId = nodeId

          // 处理 ReAct Agent 节点的内部状态
          if (nodeType === 'reactAgent') {
            const reactState = executionStore.getReActState(executionId, nodeId)
            if (reactState && reactState.steps.length > 0) {
              const lastStep = reactState.steps[reactState.steps.length - 1]

              // 发送思考流式更新
              if (lastStep.thoughtStreaming && lastStep.thought) {
                options?.onProgress?.onNodeStepUpdate?.(nodeId, {
                  thought: lastStep.thought,
                })
              }

              // 发送工具调用更新
              if (lastStep.action && lastStep.observation) {
                options?.onProgress?.onNodeStepUpdate?.(nodeId, {
                  observation: lastStep.observation,
                })
              }
            }

            // 发送 ReAct Agent 状态更新（只在 reactState 存在时）
            if (reactState) {
              options?.onProgress?.onReactAgentUpdate?.(
                nodeId,
                nodeName,
                {
                  currentIteration: reactState.currentIteration,
                  maxIterations: reactState.maxIterations,
                  steps: reactState.steps,
                  currentStep: reactState.steps[reactState.steps.length - 1],
                  totalSteps: reactState.steps.length,
                }
              )
            }
          }
          // 处理 Ollama Chat 节点的流式输出
          else if (nodeType === 'ollamaChat') {
            const reasoningContent = executionStore.getReasoningStreamOutput(executionId, nodeId)
            const streamOutput = executionStore.getStreamOutput(executionId, nodeId)

            // 发送推理流式更新
            if (reasoningContent) {
              options?.onProgress?.onNodeStepUpdate?.(nodeId, {
                thought: reasoningContent,
              })
            }

            // 发送输出流式更新
            if (streamOutput) {
              options?.onProgress?.onNodeStepUpdate?.(nodeId, {
                observation: streamOutput,
              })
            }

            const nodeData = node?.data as { model?: string; label?: string }

            // 发送 Ollama Chat 状态更新
            options?.onProgress?.onOllamaChatUpdate?.(
              nodeId,
              nodeName,
              {
                model: nodeData?.model || 'unknown',
                reasoningContent: reasoningContent || undefined,
                reasoningStreaming: !!reasoningContent,
                responseContent: streamOutput || undefined,
                responseStreaming: !!streamOutput,
              }
            )
          }
        }
      })

      // 通知当前节点和进度
      if (runningNodeName !== null && runningNodeId !== null) {
        options?.onProgress?.onNodeStart(runningNodeName, runningNodeId)
      }
      options?.onProgress?.onProgress(completedNodeIds.size, totalNodesCount)
    }, 200) // 每200ms检查一次

    // 执行工作流
    let success = false
    try {
      success = await executor.execute()
    } finally {
      clearInterval(progressInterval)
    }

    addLog(`工作流执行${success ? '成功' : '失败'}`)

    // 执行完成后，进行最后一次节点状态检查，确保所有节点状态都被更新
    const finalExecutionForCheck = executionStore.getExecution(executionId)
    const finalNodeResults = finalExecutionForCheck?.context?.nodeResults
    if (finalNodeResults) {
      finalNodeResults.forEach((result, nodeId) => {
        const nodeName = nodeNameMap.get(nodeId) || nodeId
        const node = nodes.find(n => n.id === nodeId)
        const nodeType = node?.type || 'unknown'

        // 检查是否有节点已完成但还没发送完成回调
        if ((result.status === 'success' || result.status === 'error') && !completedNodeIds.has(nodeId)) {
          completedNodeIds.add(nodeId)
          const startTime = nodeStartTimes.get(nodeId) || Date.now()
          const endTime = Date.now()

          // 更新节点步骤为完成状态
          options?.onProgress?.onNodeStep?.({
            id: `nodestep_${nodeId}`,
            nodeId,
            nodeName,
            nodeType,
            status: result.status === 'success' ? 'completed' : 'error',
            startTime,
            endTime,
            observation: typeof result.output === 'string' ? result.output : JSON.stringify(result.output),
            error: result.error,
          })
        }
      })
    }

    // 执行完成后，确保进度更新到 100%
    options?.onProgress?.onProgress(totalNodesCount, totalNodesCount)

    // 从执行上下文获取执行结果
    const finalExecution = executionStore.getExecution(executionId)
    const nodeResults = finalExecution?.context?.nodeResults || new Map()

    // 收集输出节点的结果
    const outputNodes = nodes.filter((n) => n.type === 'output')
    let output: unknown = null

    if (outputNodes.length > 0) {
      const outputs: Record<string, unknown> = {}
      for (const outputNode of outputNodes) {
        const result = nodeResults.get(outputNode.id)
        if (result?.output !== undefined) {
          const outputKey = (outputNode.data.label as string) || outputNode.id
          outputs[outputKey] = result.output
        }
      }
      output = Object.keys(outputs).length === 1 ? Object.values(outputs)[0] : outputs
      addLog(`输出结果: ${JSON.stringify(output).slice(0, 500)}...`)
    } else {
      // 如果没有输出节点，返回所有节点结果
      const allOutputs: Record<string, unknown> = {}
      nodeResults.forEach((result, nodeId) => {
        const node = nodes.find((n) => n.id === nodeId)
        if (node && result.output !== undefined) {
          allOutputs[(node.data.label as string) || nodeId] = result.output
        }
      })
      output = allOutputs
    }

    // 如果执行失败，从节点结果中查找错误信息
    let error: string | undefined
    if (!success) {
      // 查找失败的节点
      for (const [nodeId, result] of nodeResults) {
        if (result?.status === 'error') {
          const node = nodes.find((n) => n.id === nodeId)
          const nodeName = node?.data?.label || nodeId
          error = `节点 "${nodeName}" 执行失败: ${result.error || '未知错误'}`
          addLog(error)
          break
        }
      }
      if (!error) {
        error = '工作流执行失败，但未找到具体错误信息'
        addLog(error)
      }
    }

    // 收集生成的文件（通过 writeFile 节点）
    const generatedFiles: GeneratedFileInfo[] = []
    nodeResults.forEach((result, nodeId) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (node?.type === 'writeFile' && result.output) {
        const output = result.output as { path?: string; success?: boolean; bytesWritten?: number }
        if (output.path && output.success) {
          generatedFiles.push({
            path: output.path,
            workspacePath,
            type: 'created',
            size: output.bytesWritten,
          })
        }
      }
    })

    // 获取执行后的文件快照并比较变更
    addLog('获取执行后文件快照...')
    const afterSnapshot = await takeFileSnapshot(workspacePath)
    addLog(`执行后快照: ${afterSnapshot.files.size} 个文件`)

    const fileChanges = compareSnapshots(beforeSnapshot, afterSnapshot)
    addLog(`文件变更: 新增 ${fileChanges.created.length}, 修改 ${fileChanges.modified.length}, 删除 ${fileChanges.deleted.length}`)

    // 将快照检测到的变更转换为 GeneratedFileInfo 格式
    const snapshotGeneratedFiles: GeneratedFileInfo[] = [
      ...fileChanges.created.map(f => ({
        path: f.path,
        workspacePath,
        type: 'created' as const,
        size: f.size,
      })),
      ...fileChanges.modified.map(f => ({
        path: f.path,
        workspacePath,
        type: 'modified' as const,
        size: f.size,
      })),
    ]

    // 合并 writeFile 节点结果和快照检测结果（去重）
    const allGeneratedFiles = [...generatedFiles]
    for (const file of snapshotGeneratedFiles) {
      // 如果快照检测到的文件不在 writeFile 节点结果中，则添加
      if (!allGeneratedFiles.some(f => f.path === file.path)) {
        allGeneratedFiles.push(file)
      }
    }

    if (allGeneratedFiles.length > 0) {
      addLog(`总共生成/修改 ${allGeneratedFiles.length} 个文件: ${allGeneratedFiles.map(f => `${f.path}(${f.type})`).join(', ')}`)
    }

    // 如果执行失败但有新生成的文件，尝试读取文件内容作为输出
    // 这样即使 Agent 返回"失败"，只要有数据文件生成，也能返回有意义的结果
    if (!success && allGeneratedFiles.length > 0) {
      addLog('执行虽然标记为失败，但检测到新生成的文件，尝试读取文件内容...')

      // 筛选出可能是数据文件的文件（JSON、TXT、MD、CSV 等）
      const dataFileExtensions = ['json', 'txt', 'md', 'csv', 'xml', 'yaml', 'yml']
      const dataFiles = allGeneratedFiles.filter(f => {
        const ext = f.path.split('.').pop()?.toLowerCase()
        return ext && dataFileExtensions.includes(ext)
      })

      if (dataFiles.length > 0) {
        addLog(`找到 ${dataFiles.length} 个可能的数据文件，尝试读取...`)

        const fileContents: Record<string, unknown> = {}
        let hasValidContent = false

        for (const file of dataFiles) {
          try {
            const readResult = await window.electronAPI.file.read(workspacePath, file.path)
            if (readResult.success && readResult.content) {
              // 尝试解析 JSON
              if (file.path.endsWith('.json')) {
                try {
                  fileContents[file.path] = JSON.parse(readResult.content)
                } catch {
                  fileContents[file.path] = readResult.content
                }
              } else {
                fileContents[file.path] = readResult.content
              }
              hasValidContent = true
              addLog(`成功读取文件: ${file.path}`)
            }
          } catch (e) {
            addLog(`读取文件失败: ${file.path}, 错误: ${e}`)
          }
        }

        // 如果成功读取了文件内容，将其作为输出返回，并将 success 标记为 true
        if (hasValidContent) {
          // 如果只有一个文件，直接返回其内容；否则返回对象
          const fileOutput = Object.keys(fileContents).length === 1
            ? Object.values(fileContents)[0]
            : fileContents

          addLog('从生成的文件中提取到有效内容，将作为输出返回')

          // 清理执行状态
          executionStore.deleteExecution(executionId)

          return {
            success: true,  // 标记为成功，因为有有效输出
            output: fileOutput,
            logs,
            totalNodes: totalNodesCount,
            generatedFiles: allGeneratedFiles,
          }
        }
      }
    }

    // 清理执行状态
    executionStore.deleteExecution(executionId)

    return {
      success,
      output,
      error,
      logs,
      totalNodes: totalNodesCount,
      generatedFiles: allGeneratedFiles,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLog(`执行错误: ${errorMessage}`)
    return {
      success: false,
      output: null,
      error: errorMessage,
      logs,
    }
  }
}
