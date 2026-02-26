import { memo, forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReActStep } from '@/types/node'

interface ReActStepCardProps {
  step: ReActStep
  isExpanded: boolean
  onToggle: () => void
}

const ReActStepCard = forwardRef<HTMLDivElement, ReActStepCardProps>(
  function ReActStepCard({ step, isExpanded, onToggle }, _ref) {
    const getStatusIcon = () => {
      switch (step.status) {
        case 'thinking':
          return (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              🤔
            </motion.span>
          )
        case 'acting':
          return (
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              🔧
            </motion.span>
          )
        case 'observing':
          return (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              👁
            </motion.span>
          )
        case 'completed':
          return <span>✅</span>
        case 'error':
          return <span>❌</span>
        default:
          return <span>⏳</span>
      }
    }

    const getStatusColor = () => {
      switch (step.status) {
        case 'thinking':
          return 'border-[var(--color-node-ai-border)] bg-[var(--color-node-ai-bg)]'
        case 'acting':
          return 'border-[var(--color-node-logic-border)] bg-[var(--color-node-logic-bg)]'
        case 'observing':
          return 'border-[var(--color-node-input-border)] bg-[var(--color-node-input-bg)]'
        case 'completed':
          return 'border-green-500/30 bg-green-500/5'
        case 'error':
          return 'border-red-500/30 bg-red-500/5'
        default:
          return 'border-[var(--color-border-subtle)] bg-[var(--color-bg-input)]'
      }
    }

    const getSummaryText = () => {
      if (step.action) {
        return step.action
      }
      if (step.thought) {
        return step.thought.length > 30 ? step.thought.slice(0, 30) + '...' : step.thought
      }
      return '思考中...'
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-lg border overflow-hidden ${getStatusColor()}`}
      >
        {/* Header - Always visible */}
        <div
          className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors"
          onClick={onToggle}
        >
          {getStatusIcon()}
          <span className="text-xs text-[var(--color-text-subtle)]">步骤 {step.iteration}</span>
          <span className="text-xs font-medium text-[var(--color-text)] flex-1 truncate">
            {getSummaryText()}
          </span>
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="text-xs text-[var(--color-text-subtle)]"
          >
            ▼
          </motion.span>
        </div>

        {/* Expandable Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2 border-t border-[var(--color-border-subtle)] space-y-2">
                {/* Thought Section */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">💭</span>
                    <span className="text-[10px] text-[var(--color-node-ai)] font-medium">思考</span>
                    {step.thoughtStreaming && (
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="text-[8px] text-[var(--color-node-ai)]"
                      >
                        ●
                      </motion.span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text)] whitespace-pre-wrap leading-relaxed pl-5">
                    {step.thought || '...'}
                  </p>
                </div>

                {/* Action Section */}
                {step.action && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🔧</span>
                      <span className="text-[10px] text-[var(--color-node-logic)] font-medium">行动</span>
                    </div>
                    <div className="pl-5 space-y-1">
                      <div className="text-xs text-[var(--color-node-logic)] font-mono">{step.action}</div>
                      {step.actionInput && (
                        <div className="text-[10px] text-[var(--color-text-muted)] font-mono bg-[var(--color-bg-input)] rounded px-2 py-1 overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap break-all">
                          {step.actionInput.length > 200
                            ? step.actionInput.slice(0, 200) + '...'
                            : step.actionInput}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Observation Section */}
                {step.observation && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">👁</span>
                      <span className="text-[10px] text-[var(--color-node-input)] font-medium">观察</span>
                      {step.observationStreaming && (
                        <motion.span
                          animate={{ opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="text-[8px] text-[var(--color-node-input)]"
                        >
                          ●
                        </motion.span>
                      )}
                    </div>
                    <div
                      className={`text-[10px] font-mono bg-[var(--color-bg-input)] rounded px-2 py-1 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-all ${
                        step.observationError ? 'text-red-500' : 'text-[var(--color-text-muted)]'
                      }`}
                    >
                      {step.observation.length > 500
                        ? step.observation.slice(0, 500) + '...'
                        : step.observation}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }
)

export default memo(ReActStepCard)
