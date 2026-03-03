import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import PlanQuestionsDialog from '../nodes/plan/PlanQuestionsDialog'
import ReactAgentInputDialog from '../nodes/react-agent/ReactAgentInputDialog'
import { generatePlanFromAnswers } from '@/engine/nodes/plan'
import { continueReactAgentWithUserInput } from '@/engine/nodes/react-agent'
import type { PlanNodeData, ReactAgentNodeData } from '@/types/node'

export default function PlanQuestionsManager() {
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)
  const workspaceConfig = useWorkspaceStore((state) => state.currentWorkspace?.config)
  const nodes = useWorkflowStore((state) => state.nodes)

  // Get current workspace's pending question and context
  const pendingQuestion = useExecutionStore((state) => {
    if (!workspacePath) return null
    const result = state.getPendingQuestionForWorkspace(workspacePath)
    console.log('[PlanQuestionsManager] pendingQuestion selector result:', result?.nodeType, result?.nodeId)
    return result
  })

  const executionContext = useExecutionStore((state) => {
    if (!workspacePath) return null
    return state.getExecutionContextForWorkspace(workspacePath)
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!pendingQuestion) {
    return null
  }

  console.log('[PlanQuestionsManager] Rendering with pendingQuestion:', {
    nodeType: pendingQuestion.nodeType,
    nodeId: pendingQuestion.nodeId,
    executionId: pendingQuestion.executionId,
    questionsCount: pendingQuestion.questions?.length,
    hasQuestions: !!pendingQuestion.questions,
    questions: pendingQuestion.questions
  })

  // Use executionId from pendingQuestion to ensure correct execution is updated
  // This is critical when multiple executions are running in parallel
  const executionId = pendingQuestion.executionId
  const node = nodes.find(n => n.id === pendingQuestion.nodeId)

  const handlePlanSubmit = async (answers: Record<string, string>) => {
    console.log('[PlanQuestionsManager] handlePlanSubmit called', { isSubmitting, executionId })
    if (isSubmitting) return

    const nodeData = node?.data as PlanNodeData | undefined
    if (!nodeData) {
      console.error('[PlanQuestionsManager] No node data found')
      return
    }

    // Capture all needed data before clearing pendingQuestion
    const questionData = pendingQuestion
    const capturedExecutionId = executionId

    console.log('[PlanQuestionsManager] Starting plan generation', { capturedExecutionId, nodeId: questionData.nodeId })

    setIsSubmitting(true)

    // Clear pending question to close the dialog
    console.log('[PlanQuestionsManager] Clearing pending question')
    useExecutionStore.getState().clearPendingQuestion(capturedExecutionId)

    try {
      console.log('[PlanQuestionsManager] Calling generatePlanFromAnswers')
      const plan = await generatePlanFromAnswers(
        capturedExecutionId,
        questionData.nodeId,
        questionData.analysis || '',
        answers,
        nodeData.systemPrompt,
        nodeData.model,
        nodeData.temperature,
        nodeData.maxTokens,
        workspaceConfig?.ollamaHost || 'http://127.0.0.1:11434',
        nodeData.debugMode
      )

      console.log('[PlanQuestionsManager] Plan generated successfully, updating node status')
      useExecutionStore.getState().updateNodeStatus(capturedExecutionId, questionData.nodeId, {
        nodeId: questionData.nodeId,
        status: 'success',
        output: {
          plan,
          analysis: questionData.analysis,
          hadQuestions: true,
        },
        duration: 0,
        timestamp: new Date().toISOString(),
      })
      console.log('[PlanQuestionsManager] Node status updated')
    } catch (error) {
      console.error('[PlanQuestionsManager] Failed to generate plan:', error)
      useExecutionStore.getState().updateNodeStatus(capturedExecutionId, questionData.nodeId, {
        nodeId: questionData.nodeId,
        status: 'error',
        error: error instanceof Error ? error.message : '未知错误',
        duration: 0,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setIsSubmitting(false)
      console.log('[PlanQuestionsManager] handlePlanSubmit finished')
    }
  }

  const handleReactAgentSubmit = async (userInput: string) => {
    if (isSubmitting || !workspacePath) return

    const nodeData = node?.data as ReactAgentNodeData | undefined
    if (!nodeData) return

    const questionData = pendingQuestion
    setIsSubmitting(true)

    useExecutionStore.getState().clearPendingQuestion(executionId)

    try {
      // Get execution context from store (it's in the local variable now)
      if (!executionContext) {
        throw new Error('Execution context not found')
      }

      const result = await continueReactAgentWithUserInput(
        questionData.nodeId,
        userInput,
        nodeData,
        {
          ...executionContext,
          workspacePath,
          ollamaHost: workspaceConfig?.ollamaHost || 'http://127.0.0.1:11434',
          variables: executionContext.variables || {},
          userInputValues: new Map(),
          onLog: (log) => {
            useExecutionStore.getState().addLog(executionId, log)
          },
          onStream: (nodeId, chunk) => {
            useExecutionStore.getState().appendStreamOutput(executionId, nodeId, chunk)
          },
        }
      )

      useExecutionStore.getState().updateNodeStatus(executionId, questionData.nodeId, {
        nodeId: questionData.nodeId,
        status: 'success',
        output: result,
        duration: 0,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('[PlanQuestionsManager] Failed to continue ReAct agent:', error)
      useExecutionStore.getState().updateNodeStatus(executionId, questionData.nodeId, {
        nodeId: questionData.nodeId,
        status: 'error',
        error: error instanceof Error ? error.message : '未知错误',
        duration: 0,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    console.log('[PlanQuestionsManager] handleCancel called', {
      executionId,
      nodeId: pendingQuestion.nodeId,
    })

    const result = {
      nodeId: pendingQuestion.nodeId,
      status: 'error' as const,
      error: '用户取消了输入',
      duration: 0,
      timestamp: new Date().toISOString(),
    }

    console.log('[PlanQuestionsManager] Calling updateNodeStatus with:', { executionId, nodeId: pendingQuestion.nodeId, result })

    useExecutionStore.getState().updateNodeStatus(executionId, pendingQuestion.nodeId, result)

    console.log('[PlanQuestionsManager] Calling clearPendingQuestion')
    useExecutionStore.getState().clearPendingQuestion(executionId)
  }

  const showPlanDialog = pendingQuestion.nodeType === 'plan' && pendingQuestion.questions && pendingQuestion.questions.length > 0
  const showReactAgentDialog = pendingQuestion.nodeType === 'reactAgent' && pendingQuestion.prompt

  console.log('[PlanQuestionsManager] Dialog conditions:', {
    showPlanDialog,
    showReactAgentDialog,
    nodeType: pendingQuestion.nodeType,
    questionsLength: pendingQuestion.questions?.length,
    hasPrompt: !!pendingQuestion.prompt
  })

  return (
    <AnimatePresence>
      {showPlanDialog && (
        <PlanQuestionsDialog
          questions={pendingQuestion.questions!}
          onSubmit={handlePlanSubmit}
          onCancel={handleCancel}
          taskDescription={pendingQuestion.analysis}
        />
      )}

      {showReactAgentDialog && (
        <ReactAgentInputDialog
          prompt={pendingQuestion.prompt!}
          context={pendingQuestion.context}
          onSubmit={handleReactAgentSubmit}
          onCancel={handleCancel}
        />
      )}
    </AnimatePresence>
  )
}
