import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, PlanNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'
import { OpenAIClient } from '../openai-client'
import { useExecutionStore } from '@/store/execution-store'
import { resolveAIConfig, resolveModel } from '../config-resolver'

/**
 * Get API configuration from global config
 */
async function getAPIConfig(): Promise<{ apiKey: string; apiEndpoint: string }> {
  const config = await resolveAIConfig()
  return {
    apiKey: config.apiKey || '',
    apiEndpoint: config.apiEndpoint,
  }
}

/**
 * Call AI with prompt and return response
 */
async function callAI(
  prompt: string,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const { apiKey, apiEndpoint } = await getAPIConfig()
  const client = new OpenAIClient(apiKey, apiEndpoint)

  const result = await client.chat({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
  })

  return result.content || ''
}

/**
 * Parse JSON from AI response
 */
function parseJSONResponse(response: string): unknown {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return null
  } catch (error) {
    console.error('[PlanExecutor] Failed to parse JSON:', error)
    return null
  }
}

/**
 * Plan Node Executor
 */
export const planExecutor: NodeExecutor = {
  async execute(
    node: Node<WorkflowNodeData>,
    input: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<unknown> {
    const data = node.data as PlanNodeData
    const executionStore = useExecutionStore.getState()

    const userTask = String(input.task || input.input || '')

    if (!userTask.trim()) {
      throw new Error('任务描述不能为空')
    }

    context.onLog?.({
      nodeId: node.id,
      nodeName: data.label,
      level: 'info',
      message: `开始分析任务: ${userTask.substring(0, 50)}...`,
    })

    executionStore.initPlanState(context.executionId, node.id)
    executionStore.updatePlanPhase(context.executionId, node.id, 'analyzing')

    try {
      const systemPrompt = interpolateVariables(data.systemPrompt, { ...context.variables, ...input })

      // 解析最终使用的模型：节点未配置时回退到全局默认模型
      const model = resolveModel(data.model)
      if (!model) {
        throw new Error('未配置模型：请在节点中设置模型，或在全局配置中设置默认模型')
      }

      const analysisPrompt = `${systemPrompt}

用户任务：${userTask}

请分析这个任务，判断是否需要更多信息：
1. 如果任务描述已经足够清晰完整，直接返回：{"needsQuestions": false, "analysis": "你的分析结果"}
2. 如果需要更多信息，返回：
{
  "needsQuestions": true,
  "analysis": "你的分析结果",
  "questions": [
    {
      "id": "question1",
      "question": "问题文本",
      "type": "text|textarea|select|multiselect|number|boolean",
      "options": ["选项1", "选项2"],
      "required": true,
      "placeholder": "提示文本"
    }
  ]
}

注意：
- 问题应该一次性收集所有必要信息，避免多轮交互
- 每个问题都应该明确、具体
- type字段说明：
  - text: 单行文本
  - textarea: 多行文本
  - select: 单选下拉（需要options）
  - multiselect: 多选（需要options）
  - number: 数字
  - boolean: 是/否
- 只有在确实无法执行任务时才提问，如果任务已经足够清晰，直接返回 needsQuestions: false

请只返回 JSON，不要有其他说明文字。`

      const analysisResponse = await callAI(
        analysisPrompt,
        model,
        data.temperature,
        data.maxTokens
      )

      const analysisData = parseJSONResponse(analysisResponse) as {
        needsQuestions?: boolean
        analysis?: string
        questions?: Array<{
          id: string
          question: string
          type: string
          options?: string[]
          required?: boolean
          placeholder?: string
        }>
      } | null

      if (!analysisData) {
        throw new Error('无法解析AI分析结果')
      }

      executionStore.updatePlanPhase(context.executionId, node.id, 'analyzing', {
        analysisResult: analysisData.analysis
      })

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `分析完成: ${analysisData.analysis}`,
      })

      if (analysisData.needsQuestions && analysisData.questions?.length > 0) {
        executionStore.setPlanQuestions(context.executionId, node.id, analysisData.questions, analysisData.analysis || '')

        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `需要用户回答 ${analysisData.questions.length} 个问题`,
        })

        return {
          status: 'waiting',
          questions: analysisData.questions,
          analysis: analysisData.analysis,
        }
      }

      const planPrompt = `${systemPrompt}

用户任务：${userTask}

基于以上任务描述，请生成详细的执行计划。

计划应该包括：
1. 任务目标
2. 执行步骤（按顺序）
3. 所需资源
4. 潜在风险
5. 预期结果

请以清晰的Markdown格式输出计划。`

      const plan = await callAI(
        planPrompt,
        model,
        data.temperature,
        data.maxTokens
      )

      executionStore.setPlanResult(context.executionId, node.id, plan)

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: '计划生成完成',
      })

      return {
        plan,
        analysis: analysisData.analysis,
        hadQuestions: false,
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      executionStore.setPlanError(context.executionId, node.id, errorMessage)

      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'error',
        message: `执行失败: ${errorMessage}`,
      })

      throw error
    }
  },
}

/**
 * Generate plan from answers (called when user submits answers)
 */
export async function generatePlanFromAnswers(
  executionId: string,
  nodeId: string,
  userTask: string,
  answers: Record<string, string>,
  systemPrompt: string,
  model: string,
  temperature: number,
  maxTokens: number,
  context: ExecutionContext
): Promise<string> {
  const executionStore = useExecutionStore.getState()

  executionStore.updatePlanPhase(executionId, nodeId, 'generating')
  executionStore.setPlanAnswers(executionId, nodeId, answers)

  const answersText = Object.entries(answers)
    .map(([id, value]) => `${id}: ${value}`)
    .join('\n')

  const prompt = `${systemPrompt}

用户任务：${userTask}

用户补充信息：
${answersText}

基于以上信息，请生成详细的执行计划。

计划应该包括：
1. 任务目标
2. 执行步骤（按顺序）
3. 所需资源
4. 潜在风险
5. 预期结果

请以清晰的Markdown格式输出计划。`

  try {
    const plan = await callAI(prompt, model, temperature, maxTokens, context)

    executionStore.setPlanResult(executionId, nodeId, plan)

    return plan
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    executionStore.setPlanError(executionId, nodeId, errorMessage)
    throw error
  }
}
