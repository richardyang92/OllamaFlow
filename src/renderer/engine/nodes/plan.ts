import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, PlanNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { interpolateVariables } from '../executor'
import { Ollama } from 'ollama/browser'
import { OpenAIClient } from '../openai-client'
import { useExecutionStore } from '@/store/execution-store'

/**
 * Call AI with prompt and return response
 */
async function callAI(
  prompt: string,
  model: string,
  temperature: number,
  maxTokens: number,
  ollamaHost: string,
  debugMode?: PlanNodeData['debugMode']
): Promise<string> {
  if (debugMode?.enabled) {
    return callOpenAI(prompt, model, temperature, maxTokens, debugMode)
  } else {
    return callOllama(prompt, model, temperature, maxTokens, ollamaHost)
  }
}

async function callOllama(
  prompt: string,
  model: string,
  temperature: number,
  maxTokens: number,
  ollamaHost: string
): Promise<string> {
  const ollama = new Ollama({ host: ollamaHost })
  
  const response = await ollama.chat({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    options: {
      temperature,
      num_predict: maxTokens,
    },
  })
  
  return response.message.content
}

async function callOpenAI(
  prompt: string,
  model: string,
  temperature: number,
  maxTokens: number,
  debugMode: NonNullable<PlanNodeData['debugMode']>
): Promise<string> {
  let apiKey = debugMode.apiKey
  
  if (!apiKey) {
    const storedKey = await window.electronAPI.openai.getApiKey(`plan-${model}`)
    if (storedKey) {
      apiKey = storedKey
    } else {
      const workspaceKey = await window.electronAPI.openai.getApiKey('workspace-default')
      if (workspaceKey) {
        apiKey = workspaceKey
      }
    }
  }
  
  if (!apiKey) {
    throw new Error('OpenAI API Key 未配置。请在调试模式设置中输入 API Key。')
  }
  
  const client = new OpenAIClient(apiKey, debugMode.apiEndpoint)
  
  const result = await client.chat({
    model: debugMode.model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
  })
  
  return result.content
}

/**
 * Parse JSON from AI response
 */
function parseJSONResponse(response: string): any {
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
    
    executionStore.initPlanState(node.id)
    executionStore.updatePlanPhase(node.id, 'analyzing')
    
    try {
      const systemPrompt = interpolateVariables(data.systemPrompt, { ...context.variables, ...input })
      
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
        data.model,
        data.temperature,
        data.maxTokens,
        context.ollamaHost,
        data.debugMode
      )
      
      const analysisData = parseJSONResponse(analysisResponse)
      
      if (!analysisData) {
        throw new Error('无法解析AI分析结果')
      }
      
      executionStore.updatePlanPhase(node.id, 'analyzing', {
        analysisResult: analysisData.analysis
      })
      
      context.onLog?.({
        nodeId: node.id,
        nodeName: data.label,
        level: 'info',
        message: `分析完成: ${analysisData.analysis}`,
      })
      
      if (analysisData.needsQuestions && analysisData.questions?.length > 0) {
        executionStore.setPlanQuestions(node.id, analysisData.questions, analysisData.analysis)
        
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
        data.model,
        data.temperature,
        data.maxTokens,
        context.ollamaHost,
        data.debugMode
      )
      
      executionStore.setPlanResult(node.id, plan)
      
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
      executionStore.setPlanError(node.id, errorMessage)
      
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
  nodeId: string,
  userTask: string,
  answers: Record<string, string>,
  systemPrompt: string,
  model: string,
  temperature: number,
  maxTokens: number,
  ollamaHost: string,
  debugMode?: PlanNodeData['debugMode']
): Promise<string> {
  const executionStore = useExecutionStore.getState()
  
  executionStore.updatePlanPhase(nodeId, 'generating')
  executionStore.setPlanAnswers(nodeId, answers)
  
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
    const plan = await callAI(prompt, model, temperature, maxTokens, ollamaHost, debugMode)
    
    executionStore.setPlanResult(nodeId, plan)
    
    return plan
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    executionStore.setPlanError(nodeId, errorMessage)
    throw error
  }
}
