import type { Node, Edge } from '@xyflow/react'
import type { WorkflowNodeData, LoopNodeData, NodeType } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables, buildInputContext, getNodeExecutor } from '../executor'
import { useExecutionStore } from '@/store/execution-store'
import type { NodeExecutionResult } from '@/types/execution'

function evaluateCondition(expression: string, vars: Record<string, unknown>): boolean {
  try {
    const evalExpression = expression
      .replace(/==/g, '===')
      .replace(/!=/g, '!==')
      .replace(/\btrue\b/g, 'true')
      .replace(/\bfalse\b/g, 'false')
      .replace(/\bnull\b/g, 'null')
      .replace(/\bundefined\b/g, 'undefined')

    const safeEval = new Function('vars', `
      with(vars) {
        try {
          return ${evalExpression};
        } catch(e) {
          return false;
        }
      }
    `)

    return Boolean(safeEval(vars))
  } catch {
    return false
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return current
}

async function executeBodyNodes(
  bodyNodeIds: string[],
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  context: ExecutionContext,
  loopVars: Record<string, unknown>
): Promise<unknown> {
  const executionStore = useExecutionStore.getState()
  const results: unknown[] = []
  const bodyNodes = bodyNodeIds
    .map(id => nodes.find(n => n.id === id))
    .filter((n): n is Node<WorkflowNodeData> => n !== undefined)

  if (bodyNodes.length === 0) {
    return { results: [], lastOutput: undefined }
  }

  const bodyOrder: string[] = []
  const visited = new Set<string>()
  
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const node of bodyNodes) {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  for (const edge of edges) {
    if (bodyNodeIds.includes(edge.source) && bodyNodeIds.includes(edge.target)) {
      const targets = adjacency.get(edge.source) || []
      targets.push(edge.target)
      adjacency.set(edge.source, targets)
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    }
  }

  const queue: string[] = []
  for (const node of bodyNodes) {
    if ((inDegree.get(node.id) || 0) === 0) {
      queue.push(node.id)
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (visited.has(nodeId)) continue
    bodyOrder.push(nodeId)
    visited.add(nodeId)

    const neighbors = adjacency.get(nodeId) || []
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0 && !visited.has(neighbor)) {
        queue.push(neighbor)
      }
    }
  }

  let lastOutput: unknown = undefined

  for (const nodeId of bodyOrder) {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) continue

    const startTime = Date.now()

    executionStore.updateNodeStatus(nodeId, {
      nodeId,
      status: 'running',
      timestamp: new Date().toISOString(),
      duration: 0,
    })

    try {
      const input = buildInputContext(nodeId, edges, executionStore.context?.nodeResults || new Map())
      
      const loopContext: ExecutionContext = {
        ...context,
        variables: { ...context.variables, ...loopVars },
      }

      const executor = getNodeExecutor(node.data.nodeType as NodeType)
      if (!executor) {
        throw new Error(`未注册节点类型的执行器: ${node.data.nodeType}`)
      }

      const output = await executor.execute(node, input, loopContext)

      lastOutput = output

      const result: NodeExecutionResult = {
        nodeId,
        status: 'success',
        input,
        output,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      executionStore.updateNodeStatus(nodeId, result)
      results.push(output)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      const result: NodeExecutionResult = {
        nodeId,
        status: 'error',
        error: errorMessage,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }

      executionStore.updateNodeStatus(nodeId, result)
      throw error
    }
  }

  return { results, lastOutput }
}

export function createLoopExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as LoopNodeData
      const vars = { ...context.variables, ...input }
      const maxIterations = Math.min(data.maxIterations || 1000, 10000)

      let iterations: Array<{ index: number; item: unknown }> = []
      let loopCount = 0
      const allResults: unknown[] = []

      let bodyNodeIds: string[] = []
      if (context.nodes) {
        bodyNodeIds = context.nodes.filter(n => n.parentId === node.id).map(n => n.id)
      }

      if (bodyNodeIds.length === 0 && data.bodyNodeIds && data.bodyNodeIds.length > 0) {
        bodyNodeIds = data.bodyNodeIds
      }

      switch (data.loopMode) {
        case 'count': {
          const count = Math.min(data.count || 0, maxIterations)
          for (let i = 0; i < count; i++) {
            iterations.push({ index: i, item: i })
          }
          loopCount = count
          break
        }

        case 'array': {
          const arraySource = interpolateVariables(data.arraySource, vars)
          let array: unknown[] = []

          if (Array.isArray(input.array)) {
            array = input.array
          } else if (Array.isArray(arraySource)) {
            array = arraySource
          } else if (typeof arraySource === 'string') {
            try {
              const parsed = JSON.parse(arraySource)
              if (Array.isArray(parsed)) {
                array = parsed
              }
            } catch {
              const nestedValue = getNestedValue(vars, data.arraySource.replace(/\{\{|\}\}/g, '').trim())
              if (Array.isArray(nestedValue)) {
                array = nestedValue
              }
            }
          }

          const limitedArray = array.slice(0, maxIterations)
          limitedArray.forEach((item, index) => {
            iterations.push({ index, item })
          })
          loopCount = limitedArray.length
          break
        }

        case 'condition': {
          const conditionExpr = data.conditionExpression || '{{index}} < 10'
          let index = 0

          while (index < maxIterations) {
            const conditionVars = {
              ...vars,
              index,
              iteration: index,
            }

            const interpolatedCondition = interpolateVariables(conditionExpr, conditionVars)

            if (!evaluateCondition(interpolatedCondition, conditionVars)) {
              break
            }

            iterations.push({ index, item: index })
            index++
          }

          loopCount = iterations.length
          break
        }
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `开始循环: 共 ${loopCount} 次迭代`,
        data: { loopMode: data.loopMode, iterations: loopCount, bodyNodeCount: bodyNodeIds.length },
      })

      const hasBodyNodes = bodyNodeIds.length > 0

      for (const iter of iterations) {
        const loopVars: Record<string, unknown> = {
          ...vars,
          [data.loopVariable]: iter.item,
          [data.indexVariable]: iter.index,
          item: iter.item,
          index: iter.index,
          isFirst: iter.index === 0,
          isLast: iter.index === loopCount - 1,
          count: loopCount,
        }

        if (hasBodyNodes && context.nodes && context.edges) {
          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'debug',
            message: `执行迭代 ${iter.index + 1}/${loopCount}`,
          })

          const bodyResult = await executeBodyNodes(
            bodyNodeIds,
            context.nodes,
            context.edges,
            context,
            loopVars
          )

          if (data.collectResults !== false) {
            allResults.push(bodyResult)
          }
        }
      }

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `循环完成: ${loopCount} 次迭代`,
      })

      return {
        item: iterations.length > 0 ? iterations[iterations.length - 1].item : undefined,
        index: iterations.length > 0 ? iterations[iterations.length - 1].index : 0,
        results: allResults,
        iterations: iterations,
        count: loopCount,
        completed: allResults.length > 0 ? allResults[allResults.length - 1] : undefined,
        [data.loopVariable]: iterations.length > 0 ? iterations[iterations.length - 1].item : undefined,
        [data.indexVariable]: iterations.length > 0 ? iterations[iterations.length - 1].index : 0,
      }
    },
  }
}
