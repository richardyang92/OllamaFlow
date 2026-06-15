/**
 * Agent SubAgent 用户输入管理器
 * 处理 Agent 调用的 SubAgent 中的用户输入请求
 */
import { useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useExecutionStore } from '@/store/execution-store'
import PlanQuestionsDialog from '../nodes/plan/PlanQuestionsDialog'
import ReactAgentInputDialog from '../nodes/react-agent/ReactAgentInputDialog'
import { generatePlanFromAnswers } from '@/engine/nodes/plan'
import { continueReactAgentWithUserInput } from '@/engine/nodes/react-agent'
import type { PlanQuestion, ReactAgentNodeData, PlanNodeData } from '@/types/node'
import type { ExecutionContext } from '@/engine/executor'
import { DEFAULT_ENDPOINTS } from '@/config/model-config'

export default function AgentQuestionsManager() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 获取当前待处理的问题
  const pendingQuestion = useExecutionStore((state) => {
    // 遍历所有执行，找到第一个有待处理问题的
    // 注意：只要有 pendingQuestion 就应该显示，不需要检查执行状态
    // 因为等待用户输入时执行可能处于各种状态
    for (const [execId, execution] of state.executions) {
      if (execution.pendingQuestion) {
        return {
          executionId: execId,
          nodeId: execution.pendingQuestion.nodeId,
          nodeType: execution.pendingQuestion.nodeType,
          questions: execution.pendingQuestion.questions,
          analysis: execution.pendingQuestion.analysis,
          prompt: execution.pendingQuestion.prompt,
          context: execution.pendingQuestion.context,
          workspacePath: execution.workspacePath,
        }
      }
    }
    return null
  })

  // 处理 Plan 节点的问题提交
  const handlePlanSubmit = useCallback(async (answers: Record<string, string>) => {
    console.log('[AgentQuestionsManager] handlePlanSubmit called', { isSubmitting, hasPendingQuestion: !!pendingQuestion })
    if (isSubmitting || !pendingQuestion) {
      console.log('[AgentQuestionsManager] Early return - isSubmitting:', isSubmitting, 'pendingQuestion:', pendingQuestion)
      return
    }

    const { executionId, nodeId, workspacePath, analysis } = pendingQuestion
    console.log('[AgentQuestionsManager] Starting plan generation...', { executionId, nodeId, workspacePath })
    setIsSubmitting(true)

    try {
      // 获取项目配置
      const config = await window.electronAPI.workspace.readConfig(workspacePath)

      // 获取节点数据
      const workflowData = await window.electronAPI.workflow.loadData(workspacePath)
      const nodes = workflowData?.nodes as Array<{ id: string; data?: PlanNodeData }> | undefined
      const node = nodes?.find((n) => n.id === nodeId)
      const nodeData = node?.data

      if (!nodeData) {
        throw new Error('无法获取节点数据')
      }

      // Get API key for workspace
      const apiKey = await window.electronAPI.openai.getApiKey('workspace-default')

      // Build execution context for the plan generation
      const context: ExecutionContext = {
        executionId,
        workspacePath,
        apiEndpoint: config?.apiEndpoint || DEFAULT_ENDPOINTS.ollama,
        apiKey: apiKey || undefined,
        variables: {},
        userInputValues: new Map(),
      }

      // 生成计划
      const plan = await generatePlanFromAnswers(
        executionId,
        nodeId,
        analysis || '',
        answers,
        nodeData.systemPrompt,
        nodeData.model,
        nodeData.temperature,
        nodeData.maxTokens,
        context
      )

      // 更新节点状态
      useExecutionStore.getState().updateNodeStatus(executionId, nodeId, {
        nodeId,
        status: 'success',
        output: {
          plan,
          analysis,
          hadQuestions: true,
        },
        duration: 0,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('[AgentQuestionsManager] Failed to generate plan:', error)
      useExecutionStore.getState().updateNodeStatus(executionId, nodeId, {
        nodeId,
        status: 'error',
        error: error instanceof Error ? error.message : '未知错误',
        duration: 0,
        timestamp: new Date().toISOString(),
      })
    } finally {
      useExecutionStore.getState().clearPendingQuestion(executionId)
      setIsSubmitting(false)
    }
  }, [isSubmitting, pendingQuestion])

  // 处理 ReAct Agent 的用户输入
  const handleReactAgentSubmit = useCallback(async (userInput: string) => {
    if (isSubmitting || !pendingQuestion) return

    const { executionId, nodeId, workspacePath } = pendingQuestion
    setIsSubmitting(true)

    try {
      // 获取执行上下文
      const execution = useExecutionStore.getState().getExecution(executionId)
      if (!execution?.context) {
        throw new Error('执行上下文不存在')
      }

      // 获取项目配置
      const config = await window.electronAPI.workspace.readConfig(workspacePath)

      // 获取节点数据
      const workflowData = await window.electronAPI.workflow.loadData(workspacePath)
      const nodes = workflowData?.nodes as Array<{ id: string; data?: ReactAgentNodeData }> | undefined
      const node = nodes?.find((n) => n.id === nodeId)
      const nodeData = node?.data

      if (!nodeData) {
        throw new Error('无法获取节点数据')
      }

      // Get API key for workspace
      const apiKey = await window.electronAPI.openai.getApiKey('workspace-default')

      const result = await continueReactAgentWithUserInput(
        nodeId,
        userInput,
        nodeData,
        {
          ...execution.context,
          workspacePath,
          apiEndpoint: config?.apiEndpoint || DEFAULT_ENDPOINTS.ollama,
          apiKey: apiKey || undefined,
          variables: execution.context.variables || {},
          userInputValues: new Map(),
          onLog: (log) => {
            useExecutionStore.getState().addLog(executionId, log)
          },
          onStream: (nodeId, chunk) => {
            useExecutionStore.getState().appendStreamOutput(executionId, nodeId, chunk)
          },
        }
      )

      useExecutionStore.getState().updateNodeStatus(executionId, nodeId, {
        nodeId,
        status: 'success',
        output: result,
        duration: 0,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('[AgentQuestionsManager] Failed to continue ReAct agent:', error)
      useExecutionStore.getState().updateNodeStatus(executionId, nodeId, {
        nodeId,
        status: 'error',
        error: error instanceof Error ? error.message : '未知错误',
        duration: 0,
        timestamp: new Date().toISOString(),
      })
    } finally {
      useExecutionStore.getState().clearPendingQuestion(executionId)
      setIsSubmitting(false)
    }
  }, [isSubmitting, pendingQuestion])

  // 处理取消
  const handleCancel = useCallback(() => {
    if (!pendingQuestion) return

    const { executionId, nodeId } = pendingQuestion

    useExecutionStore.getState().updateNodeStatus(executionId, nodeId, {
      nodeId,
      status: 'error',
      error: '用户取消了输入',
      duration: 0,
      timestamp: new Date().toISOString(),
    })
    useExecutionStore.getState().clearPendingQuestion(executionId)
  }, [pendingQuestion])

  // 如果没有待处理的问题，不渲染任何内容
  // 注意：不再检查 isRunning，因为 SubAgent 可能等待用户输入而主 Agent 已经完成
  if (!pendingQuestion) {
    return null
  }

  const { nodeType, questions, analysis, prompt, context } = pendingQuestion
  const showPlanDialog = nodeType === 'plan' && questions && questions.length > 0
  const showReactAgentDialog = nodeType === 'reactAgent' && prompt

  return (
    <AnimatePresence>
      {showPlanDialog && (
        <PlanQuestionsDialog
          questions={questions as PlanQuestion[]}
          onSubmit={handlePlanSubmit}
          onCancel={handleCancel}
          taskDescription={analysis}
          isSubmitting={isSubmitting}
        />
      )}

      {showReactAgentDialog && (
        <ReactAgentInputDialog
          prompt={prompt}
          context={context}
          onSubmit={handleReactAgentSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      )}
    </AnimatePresence>
  )
}
