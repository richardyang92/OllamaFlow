import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, SmartRouterNodeData, SmartRouterBranch } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'
import { OpenAIClient } from '../openai-client'
import { resolveAIConfig, resolveModel } from '../config-resolver'
import { INTERNAL_LLM_PARAMS } from '@/config/model-config'

/**
 * 提取输入的实际值
 * 如果输入只有一个字段（如 { value: "..." }），提取该字段的值
 * 这样下游节点可以直接使用该值，而不是收到包装对象
 */
function extractActualValue(input: Record<string, unknown>): unknown {
  const keys = Object.keys(input)
  if (keys.length === 1) {
    return input[keys[0]]
  }
  return input
}

/**
 * Get API configuration from global config or secure storage
 */
async function getAPIConfig(context: ExecutionContext): Promise<{ apiKey: string; apiEndpoint: string }> {
  const config = await resolveAIConfig(context)
  return {
    apiKey: config.apiKey || '',
    apiEndpoint: config.apiEndpoint,
  }
}

async function callAI(
  data: SmartRouterNodeData,
  prompt: string,
  context: ExecutionContext
): Promise<string> {
  const { apiKey, apiEndpoint } = await getAPIConfig(context)
  const client = new OpenAIClient(apiKey, apiEndpoint)

  const model = resolveModel(data.model)
  if (!model) {
    throw new Error('未配置模型：请在节点中设置模型，或在全局配置中设置默认模型')
  }

  const response = await client.chat({
    model,
    messages: [
      {
        role: 'system',
        content: '你是一个智能路由助手。根据输入内容和分支描述，选择最合适的分支。只返回分支 ID，不要其他解释。'
      },
      { role: 'user', content: prompt },
    ],
    temperature: data.temperature,
    max_tokens: INTERNAL_LLM_PARAMS.routing.maxTokens,
  })

  const content = response.content || ''

  // 提取分支 ID（支持多种格式）
  const branchIdMatch = content.match(/branch-\d+/i)
  if (branchIdMatch) {
    return branchIdMatch[0]
  }

  if (content.toLowerCase().includes('default')) {
    return 'default'
  }

  return content.trim().split('\n')[0].trim()
}

function matchBranchId(response: string, branches: SmartRouterBranch[]): string | null {
  const cleanResponse = response.trim().toLowerCase()

  for (const branch of branches) {
    if (cleanResponse === branch.id.toLowerCase()) {
      return branch.id
    }
  }

  const branchIdMatch = response.match(/branch-(\d+)/i)
  if (branchIdMatch) {
    const matchedId = branchIdMatch[0].toLowerCase()
    const exactBranch = branches.find(b => b.id.toLowerCase() === matchedId)
    if (exactBranch) {
      return exactBranch.id
    }
  }

  for (const branch of branches) {
    if (cleanResponse === branch.name.toLowerCase().trim()) {
      return branch.id
    }
  }

  for (const branch of branches) {
    if (cleanResponse.includes(branch.name.toLowerCase().trim())) {
      return branch.id
    }
  }

  if (cleanResponse.includes('default') || cleanResponse.includes('默认')) {
    const defaultBranch = branches.find(b => b.isDefault)
    if (defaultBranch) {
      return defaultBranch.id
    }
  }

  return null
}

export function createSmartRouterExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as SmartRouterNodeData

      const prompt = interpolateVariables(data.routingPrompt, { ...context.variables, ...input })

      const branchDescriptions = data.branches.map(b =>
        `- ID: ${b.id}, 名称: "${b.name}", 描述: ${b.description}`
      ).join('\n')

      // 构建输入内容部分
      let inputContent = ''
      if (Object.keys(input).length > 0) {
        const inputLines = Object.entries(input).map(([key, value]) => {
          const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
          return `${key}: ${displayValue}`
        }).join('\n')
        inputContent = `\n\n【待路由的输入内容】：\n${inputLines}`
      }

      const fullPrompt = `${prompt}${inputContent}\n\n可用分支列表：\n${branchDescriptions}\n\n请仔细分析输入内容，从上面的分支列表中选择最合适的一个分支，只返回该分支的 ID（如 branch-1），不要返回其他任何内容。`

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `开始路由决策，分支数量: ${data.branches.length}`,
      })

      let rawResponse: string
      let selectedBranchId: string | null = null

      try {
        rawResponse = await callAI(data, fullPrompt, context)

        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `AI 原始响应: "${rawResponse}"`,
        })

        selectedBranchId = matchBranchId(rawResponse, data.branches)

        if (!selectedBranchId) {
          const defaultBranch = data.branches.find(b => b.isDefault)
          if (defaultBranch) {
            context.onLog?.({
              nodeId: node.id,
              nodeName: data.label,
              level: 'warn',
              message: `无法从响应中识别分支，使用默认分支 "${defaultBranch.name}"`,
            })
            selectedBranchId = defaultBranch.id
          } else {
            throw new Error(`无法从 AI 响应中识别分支 ID，且没有默认分支`)
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        const defaultBranch = data.branches.find(b => b.isDefault)
        if (defaultBranch) {
          context.onLog?.({
            nodeId: node.id,
            nodeName: data.label,
            level: 'warn',
            message: `AI 调用失败，使用默认分支 "${defaultBranch.name}"。错误: ${errorMessage}`,
          })

          selectedBranchId = defaultBranch.id
        } else {
          throw new Error(`AI 调用失败，且没有默认分支: ${errorMessage}`)
        }
      }

      const selectedBranch = data.branches.find(b => b.id === selectedBranchId)

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `路由到分支: ${selectedBranch?.name || selectedBranchId} (ID: ${selectedBranchId})`,
      })

      // 提取实际值透传：如果输入只有一个字段（如 { value: "..." }），提取其值
      // 这样下游节点可以直接使用该值，而不是收到包装对象
      const passthroughValue = extractActualValue(input)

      const output: Record<string, unknown> = {}
      for (const branch of data.branches) {
        output[branch.id] = branch.id === selectedBranchId ? passthroughValue : undefined
      }

      return output
    },
  }
}
