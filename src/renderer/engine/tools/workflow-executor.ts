/**
 * 工作流执行器 - 用于智能Agent调用工作流作为SubAgent
 */

import * as path from 'path'
import type { Node, Edge } from '@xyflow/react'
import type { WorkflowNodeData, ReActStep } from '@/types/node'
import type { GeneratedFileInfo, ReActStepSummary } from '@/store/agent-store'
import type { NodeExecutionResult } from '@/types/execution'
import { useExecutionStore } from '@/store/execution-store'
import { takeFileSnapshot, compareSnapshots } from './file-snapshot'

const DEBUG = false
const log = (...args: unknown[]) => DEBUG && console.log('[WorkflowExecutor]', ...args)

// 简化的进度回调类型
export interface SubAgentProgressCallback {
  onStatusChange: (status: 'loading' | 'running' | 'completed' | 'error') => void
  onNodeStart: (nodeName: string, nodeId: string, nodeType?: string) => void
  onNodeComplete: (nodeName: string, nodeId: string, success: boolean) => void
  onProgress: (completedNodes: number, totalNodes: number) => void
  onLog: (message: string) => void
  // ReAct Agent 步骤更新
  onReActStepsUpdate?: (nodeName: string, nodeId: string, steps: ReActStepSummary[], iteration?: number, maxIterations?: number) => void
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
    // 主Agent的沙箱路径（用于复制生成的文件）
    sandboxPath?: string
  }
): Promise<WorkflowExecutionResult> {
  const logs: string[] = []
  const addLog = (msg: string) => {
    logs.push(msg)
    options?.onLog?.(msg)
    options?.onProgress?.onLog(msg)
    log(msg)
  }

  // 主Agent的沙箱路径
  const sandboxPath = options?.sandboxPath

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

    // 获取执行前的文件快照
    addLog('获取执行前文件快照...')
    const beforeSnapshot = await takeFileSnapshot(workspacePath)
    addLog(`执行前快照: ${beforeSnapshot.files.size} 个文件`)

    // 创建执行器实例 - 使用 createExecution 返回的 executionId
    const executionStore = useExecutionStore.getState()

    // 创建执行状态，并获取真正的 executionId
    const executionId = executionStore.createExecution(workspacePath, 'subagent-workflow')

    // 创建执行器（使用隔离模式）
    const executor = new WorkflowExecutor(
      nodes,
      edges,
      workspacePath,
      executionId,
      options?.apiEndpoint || 'http://127.0.0.1:11434',
      nodeInputValues,
      true, // isolatedMode = true
      options?.apiKey
    )

    // 如果有进度回调，注册生命周期监听器
    let totalNodesCount = 0
    let unsubscribeCallbacks: (() => void) | null = null
    
    if (options?.onProgress) {
      const { 
        onStatusChange, 
        onNodeStart, 
        onNodeComplete, 
        onProgress: onProgressCallback, 
        onReActStepsUpdate 
      } = options.onProgress

      // 设置节点列表以便回调解析节点名称
      executionStore.setNodes(executionId, nodes)

      // 注册生命周期回调
      const callbacks = {
        onNodeStart: (nodeId: string, nodeName: string, nodeType: string) => {
          addLog(`节点开始: ${nodeName} (${nodeType})`)
          onNodeStart(nodeName, nodeId, nodeType)
        },
        onNodeComplete: (nodeId: string, nodeName: string, success: boolean) => {
          addLog(`节点完成: ${nodeName} (success=${success})`)
          onNodeComplete(nodeName, nodeId, success)
        },
        onNodeProgress: (completed: number, total: number) => {
          totalNodesCount = total
          addLog(`进度: ${completed}/${total}`)
          onProgressCallback(completed, total)
        },
        onReActStepUpdate: (nodeId: string, steps: ReActStep[]) => {
          const node = nodes.find((n) => n.id === nodeId)
          const nodeName = node?.data?.label || nodeId
          addLog(`ReAct 步骤更新: ${nodeName}`)
          // 将 ReActStep 转换为 ReActStepSummary（处理 null -> undefined 的类型转换）
          const stepSummaries: ReActStepSummary[] = steps.map(s => ({
            id: s.id,
            iteration: s.iteration,
            thought: s.thought,
            action: s.action ?? undefined,
            actionInput: s.actionInput ?? undefined,
            observation: s.observation ?? undefined,
            status: s.status,
          }))
          // 从 steps 中提取迭代信息
          const maxIterations = steps.length > 0 ? steps[steps.length - 1].iteration : undefined
          onReActStepsUpdate?.(nodeName, nodeId, stepSummaries, steps.length, maxIterations)
        }
      }

      unsubscribeCallbacks = executionStore.registerLifecycleCallback(executionId, callbacks)

      // 标记为运行中
      onStatusChange('running')
    }

    // 执行工作流
    addLog('开始执行工作流...')
    const executeSuccess = await executor.execute()

    // 清理生命周期回调
    if (unsubscribeCallbacks) {
      unsubscribeCallbacks()
    }

    // 收集节点结果
    const execution = executionStore.getExecution(executionId)
    const nodeResults = execution?.context?.nodeResults

    // 判断执行是否成功
    const success = executeSuccess
    addLog(`执行完成，成功: ${success}`)

    let output: unknown = null

    if (nodeResults) {
      const executedNodes: Array<{ nodeId: string; result: NodeExecutionResult }> = []

      for (const [nodeId, result] of nodeResults) {
        const node = nodes.find((n) => n.id === nodeId)
        if (node && result.status === 'success' && node.type !== 'input') {
          executedNodes.push({ nodeId, result })
        }
      }

      if (executedNodes.length > 0) {
        const lastNode = executedNodes[executedNodes.length - 1]
        output = lastNode.result.output || null
        addLog(`最后一个执行节点结果: ${JSON.stringify(output).slice(0, 200)}`)
      }
    }

    // 如果执行失败，从节点结果中查找错误信息
    let error: string | undefined
    if (!success && nodeResults) {
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
    if (nodeResults) {
      nodeResults.forEach((result, nodeId) => {
        const node = nodes.find((n) => n.id === nodeId)
        if (node?.type === 'writeFile' && result?.output) {
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
    }

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

    // 【关键】将生成的文件复制到主Agent的沙箱目录（如果提供了sandboxPath）
    let finalGeneratedFiles: GeneratedFileInfo[] = allGeneratedFiles
    if (sandboxPath && allGeneratedFiles.length > 0) {
      addLog(`将 ${allGeneratedFiles.length} 个文件复制到主Agent沙箱: ${sandboxPath}`)
      
      const filesToCopy: Array<{ sourcePath: string; destPath: string }> = []
      
      for (const file of allGeneratedFiles) {
        const sourcePath = path.join(file.workspacePath, file.path)
        const destPath = path.join(sandboxPath, file.path)
        filesToCopy.push({ sourcePath, destPath })
      }
      
      try {
        const copyResult = await window.electronAPI.file.copyFiles(filesToCopy)
        
        if (copyResult.success) {
          addLog(`文件复制成功: ${copyResult.results?.filter(r => r.success).length || 0}/${filesToCopy.length}`)
          
          // 更新生成的文件信息，将workspacePath改为sandboxPath
          finalGeneratedFiles = allGeneratedFiles.map(file => ({
            ...file,
            workspacePath: sandboxPath, // 【关键】更新为沙箱路径
          }))
          
          // 记录失败的复制
          const failedCopies = copyResult.results?.filter(r => !r.success)
          if (failedCopies && failedCopies.length > 0) {
            addLog(`警告: ${failedCopies.length} 个文件复制失败`)
            for (const fail of failedCopies) {
              addLog(`  - 失败: ${fail.sourcePath} -> ${fail.destPath}: ${fail.error}`)
            }
          }
        } else {
          addLog(`警告: 文件复制操作失败: ${copyResult.error}`)
        }
      } catch (copyError) {
        addLog(`错误: 复制文件时发生异常: ${copyError instanceof Error ? copyError.message : String(copyError)}`)
      }
    }

    // 如果执行失败但有新生成的文件，尝试读取文件内容作为输出
    // 这样即使 Agent 返回"失败"，只要有数据文件生成，也能返回有意义的结果
    if (!success && finalGeneratedFiles.length > 0) {
      addLog('执行虽然标记为失败，但检测到新生成的文件，尝试读取文件内容...')

      // 筛选出可能是数据文件的文件（JSON、TXT、MD、CSV 等）
      const dataFileExtensions = ['json', 'txt', 'md', 'csv', 'xml', 'yaml', 'yml']
      const dataFiles = finalGeneratedFiles.filter(f => {
        const ext = f.path.split('.').pop()?.toLowerCase()
        return ext && dataFileExtensions.includes(ext)
      })

      if (dataFiles.length > 0) {
        addLog(`找到 ${dataFiles.length} 个可能的数据文件，尝试读取...`)

        const fileContents: Record<string, unknown> = {}
        let hasValidContent = false

        for (const file of dataFiles) {
          try {
            // 【关键】使用更新后的 workspacePath（可能是沙箱路径）来读取文件
            const readResult = await window.electronAPI.file.read(file.workspacePath, file.path)
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
              addLog(`成功读取文件: ${file.path} (from ${file.workspacePath})`)
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
            generatedFiles: finalGeneratedFiles, // 【关键】使用更新后的文件信息
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
      generatedFiles: finalGeneratedFiles, // 【关键】使用更新后的文件信息
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