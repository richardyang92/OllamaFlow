import { memo, useEffect, useState } from 'react'
import { NodeProps } from '@xyflow/react'
import { ClipboardList, Loader2, CheckCircle, XCircle, HelpCircle } from 'lucide-react'
import BaseNode from './BaseNode'
import { PlanNodeData, PlanExecutionState, NodeStatus } from '@/types/node'
import { useExecutionStore } from '@/store/execution-store'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

function PlanNode(props: NodeProps) {
  const data = props.data as PlanNodeData
  const id = props.id as string
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>('idle')
  const [planState, setPlanState] = useState<PlanExecutionState | undefined>()
  
  useEffect(() => {
    const unsubscribe = useExecutionStore.subscribe((state) => {
      const result = state.getNodeStatus(id)
      const executionStatus = result?.status || 'idle'
      const status: NodeStatus = executionStatus === 'pending' || executionStatus === 'skipped' 
        ? 'idle' 
        : executionStatus as NodeStatus
      
      if (status !== nodeStatus) {
        setNodeStatus(status)
      }
      
      const planExecState = state.getPlanState(id)
      setPlanState(planExecState)
    })
    
    return () => unsubscribe()
  }, [id, nodeStatus])
  
  const getPhaseIcon = () => {
    if (!planState) return <ClipboardList className="w-4 h-4" />
    
    switch (planState.phase) {
      case 'analyzing':
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
      case 'questions':
        return <HelpCircle className="w-4 h-4 text-blue-400" />
      case 'generating':
        return <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <ClipboardList className="w-4 h-4" />
    }
  }
  
  const getPhaseLabel = () => {
    if (!planState) return '就绪'
    
    switch (planState.phase) {
      case 'analyzing': return '分析中'
      case 'questions': return '等待回答'
      case 'generating': return '生成中'
      case 'complete': return '完成'
      case 'error': return '错误'
      default: return '就绪'
    }
  }
  
  const getStatusColor = () => {
    if (!planState) return 'text-[var(--color-text-muted)]'
    
    switch (planState.phase) {
      case 'analyzing': return 'text-yellow-400'
      case 'questions': return 'text-blue-400'
      case 'generating': return 'text-purple-400'
      case 'complete': return 'text-green-400'
      case 'error': return 'text-red-400'
      default: return 'text-[var(--color-text-muted)]'
    }
  }
  
  return (
    <BaseNode {...props} icon={getPhaseIcon()}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">状态</span>
          <span className={cn('text-xs', getStatusColor())}>
            {getPhaseLabel()}
          </span>
        </div>
        
        {data.debugMode?.enabled && (
          <div className="text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
            🔬 {data.debugMode.model}
          </div>
        )}
        
        {!data.debugMode?.enabled && (
          <div className="text-xs text-[var(--color-text-muted)]">
            🤖 {data.model}
          </div>
        )}
        
        <AnimatePresence>
          {planState?.analysisResult && planState.phase !== 'analyzing' && (
            <motion.div
              key="analysis-result"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-[var(--color-text-muted)] line-clamp-2"
            >
              {planState.analysisResult}
            </motion.div>
          )}
          
          {planState?.phase === 'questions' && planState.questions && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-blue-400"
            >
              等待回答 {planState.questions.length} 个问题
            </motion.div>
          )}
          
          {planState?.generatedPlan && (
            <motion.div
              key="generated-plan"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-green-400 line-clamp-2"
            >
              计划已生成
            </motion.div>
          )}
          
          {planState?.error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-red-400"
            >
              错误: {planState.error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BaseNode>
  )
}

export default memo(PlanNode)
