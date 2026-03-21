import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { ClipboardList, Loader2, CheckCircle, XCircle, HelpCircle, Microscope } from 'lucide-react'
import BaseNode from './BaseNode'
import { PlanNodeData } from '@/types/node'
import { usePlanState } from '@/hooks/usePlanState'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

function PlanNode(props: NodeProps) {
  const data = props.data as PlanNodeData
  const id = props.id as string

  // Use hook to get plan state (workspace-aware)
  const planState = usePlanState(id)

  const getPhaseIcon = () => {
    if (!planState) return <ClipboardList className="w-4 h-4" />

    switch (planState.phase) {
      case 'analyzing':
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
      case 'questions':
        return <HelpCircle className="w-4 h-4 text-blue-400" />
      case 'generating':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
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
      case 'generating': return 'text-blue-400'
      case 'complete': return 'text-green-400'
      case 'error': return 'text-red-400'
      default: return 'text-[var(--color-text-muted)]'
    }
  }

  return (
    <BaseNode {...props} icon={data.debugMode?.enabled ? <Microscope className="w-4 h-4" /> : getPhaseIcon()}>
      <div className="space-y-3 w-full">
        {/* Model badge - consistent with other AI nodes */}
        <div className="node-primary-badge ai">
          {data.debugMode?.enabled ? <Microscope className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
          <span className="font-semibold truncate">
            {data.debugMode?.enabled ? data.debugMode.model : data.model}
          </span>
        </div>

        {/* Debug Mode indicator - consistent with other nodes */}
        {data.debugMode?.enabled && (
          <div className="text-[10px] px-2 py-1 bg-amber-500/20 text-amber-400 rounded flex items-center gap-1">
            <Microscope className="w-3 h-3" /> Debug Mode (OpenAI)
          </div>
        )}

        {/* Status indicator */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">状态</span>
          <span className={cn('text-xs', getStatusColor())}>
            {getPhaseLabel()}
          </span>
        </div>

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
