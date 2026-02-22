import { memo, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReActExecutionState } from '@/types/node'
import ReActStepCard from './ReActStepCard'

interface ReActStepsPanelProps {
  state: ReActExecutionState
}

function ReActStepsPanel({ state }: ReActStepsPanelProps) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when steps change or content updates
  useEffect(() => {
    if (containerRef.current && state.isRunning) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      }, 0)
    }
  }, [state.steps, state.isRunning, state.todos])

  // Auto-expand the latest step during execution, collapse completed steps
  useEffect(() => {
    if (state.isRunning && state.steps.length > 0) {
      const latestStep = state.steps[state.steps.length - 1]
      if (latestStep.status !== 'completed') {
        setExpandedStepId(latestStep.id)
      }
    }
  }, [state.steps.length, state.isRunning, state.steps])

  // When execution completes, collapse all steps
  useEffect(() => {
    if (!state.isRunning && state.steps.length > 0) {
      // Keep only the last step expanded when complete, or collapse all if there's a final answer
      if (state.finalAnswer) {
        setExpandedStepId(null)
      }
    }
  }, [state.isRunning, state.finalAnswer, state.steps.length])

  const toggleStep = (stepId: string) => {
    setExpandedStepId(expandedStepId === stepId ? null : stepId)
  }

  // Calculate todo stats
  const todos = state.todos || []
  const completedCount = todos.filter(t => t.completed).length
  const totalCount = todos.length

  return (
    <div className="space-y-2">
      {/* Progress indicator */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-2">
        <span>迭代进度</span>
        <span className="font-mono">
          {state.currentIteration} / {state.maxIterations}
        </span>
      </div>

      {/* Todo List Display */}
      {todos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 mb-2"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">📋</span>
              <span className="text-[10px] text-blue-400 font-medium">任务列表</span>
            </div>
            <span className="text-[10px] text-gray-400">
              {completedCount}/{totalCount} 完成
            </span>
          </div>
          <div className="space-y-1">
            {todos.map((todo) => (
              <motion.div
                key={todo.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-1.5 text-[10px] ${
                  todo.completed ? 'text-green-400' : 'text-gray-300'
                }`}
              >
                <span>{todo.completed ? '✅' : '⬜'}</span>
                <span className={todo.completed ? 'line-through opacity-70' : ''}>
                  {todo.content}
                </span>
              </motion.div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}

      {/* Steps container */}
      <div ref={containerRef} className="space-y-2 max-h-64 overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {state.steps.map((step) => (
            <ReActStepCard
              key={step.id}
              step={step}
              isExpanded={expandedStepId === step.id}
              onToggle={() => toggleStep(step.id)}
            />
          ))}
        </AnimatePresence>

        {/* Final Answer */}
        {state.finalAnswer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg border border-green-500/30 bg-green-500/5 p-3"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">✅</span>
              <span className="text-[10px] text-green-400 font-medium">最终答案</span>
            </div>
            <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
              {state.finalAnswer}
            </p>
          </motion.div>
        )}

        {/* Error display */}
        {state.error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-red-500/30 bg-red-500/5 p-3"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">❌</span>
              <span className="text-[10px] text-red-400 font-medium">错误</span>
            </div>
            <p className="text-xs text-red-300">{state.error}</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default memo(ReActStepsPanel)
