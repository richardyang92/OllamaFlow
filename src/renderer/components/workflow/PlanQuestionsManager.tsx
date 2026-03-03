import { useEffect, useState } from 'react'
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
  const { pendingQuestion, executionContext } = useExecutionStore((state) => {
    const wsPath = workspacePath || state.currentWorkspacePath
    if (!wsPath) {
      return { pendingQuestion: null, executionContext: null }
    }
    const workspaceState = state.workspaces.get(wsPath)
    return {
      pendingQuestion: workspaceState?.pendingQuestion || null,
      executionContext: workspaceState?.context || null
    }
  })

  const clearPendingQuestion = useExecutionStore((state) => state.clearPendingQuestion)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  useEffect(() => {
    if (pendingQuestion) {
      console.log('[PlanQuestionsManager] Pending question detected:', pendingQuestion.nodeId, 'type:', pendingQuestion.nodeType)
    }
  }, [pendingQuestion])
  
  if (!pendingQuestion) {
    return null
  }
  
  const node = nodes.find(n => n.id === pendingQuestion.nodeId)
  
  const handlePlanSubmit = async (answers: Record<string, string>) => {
    if (!workspacePath || isSubmitting || !pendingQuestion) return
    
    const nodeData = node?.data as PlanNodeData | undefined
    if (!nodeData) return
    
    const questionData = pendingQuestion
    setIsSubmitting(true)
    
    clearPendingQuestion()
    
    try {
      const plan = await generatePlanFromAnswers(
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
      
      useExecutionStore.getState().updateNodeStatus(questionData.nodeId, {
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
    } catch (error) {
      console.error('[PlanQuestionsManager] Failed to generate plan:', error)
      useExecutionStore.getState().updateNodeStatus(questionData.nodeId, {
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
  
  const handleReactAgentSubmit = async (userInput: string) => {
    if (!workspacePath || isSubmitting || !pendingQuestion) return

    const nodeData = node?.data as ReactAgentNodeData | undefined
    if (!nodeData) return

    const questionData = pendingQuestion
    setIsSubmitting(true)

    clearPendingQuestion()

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
          workspacePath: workspacePath,
          ollamaHost: workspaceConfig?.ollamaHost || 'http://127.0.0.1:11434',
          variables: executionContext.variables || {},
          userInputValues: new Map(),
          onLog: (log) => {
            useExecutionStore.getState().addLog(log)
          },
          onStream: (nodeId, chunk) => {
            useExecutionStore.getState().appendStreamOutput(nodeId, chunk)
          },
        }
      )
      
      useExecutionStore.getState().updateNodeStatus(questionData.nodeId, {
        nodeId: questionData.nodeId,
        status: 'success',
        output: result,
        duration: 0,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('[PlanQuestionsManager] Failed to continue ReAct agent:', error)
      useExecutionStore.getState().updateNodeStatus(questionData.nodeId, {
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
    if (!pendingQuestion) return
    
    useExecutionStore.getState().updateNodeStatus(pendingQuestion.nodeId, {
      nodeId: pendingQuestion.nodeId,
      status: 'error',
      error: '用户取消了输入',
      duration: 0,
      timestamp: new Date().toISOString(),
    })
    
    clearPendingQuestion()
  }
  
  return (
    <AnimatePresence>
      {pendingQuestion.nodeType === 'plan' && pendingQuestion.questions && pendingQuestion.questions.length > 0 && (
        <PlanQuestionsDialog
          questions={pendingQuestion.questions}
          onSubmit={handlePlanSubmit}
          onCancel={handleCancel}
          taskDescription={pendingQuestion.analysis}
        />
      )}
      
      {pendingQuestion.nodeType === 'reactAgent' && pendingQuestion.prompt && (
        <ReactAgentInputDialog
          prompt={pendingQuestion.prompt}
          context={pendingQuestion.context}
          onSubmit={handleReactAgentSubmit}
          onCancel={handleCancel}
        />
      )}
    </AnimatePresence>
  )
}
