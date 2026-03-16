/**
 * Agent 迭代限制提示组件
 * 当助手达到最大思考轮数时显示，提供继续和停止选项
 */

import { motion } from 'framer-motion'
import { Play, StopCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentIterationLimitPromptProps {
  currentIteration: number
  onContinue: () => void
  onStop: () => void
}

export function AgentIterationLimitPrompt({
  currentIteration,
  onContinue,
  onStop,
}: AgentIterationLimitPromptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mx-4 mb-4 p-4 rounded-xl glass-panel border border-yellow-500/30"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <span className="text-sm">⚠️</span>
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--color-text)]">
              已达到思考轮数上限
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              当前已完成 {currentIteration} 轮思考
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium',
              'bg-red-500/10 text-red-400',
              'hover:bg-red-500/20',
              'transition-all duration-200'
            )}
          >
            <div className="flex items-center gap-1.5">
              <StopCircle className="w-3.5 h-3.5" />
              <span>停止</span>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onContinue}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium',
              'bg-green-500/10 text-green-400',
              'hover:bg-green-500/20',
              'transition-all duration-200'
            )}
          >
            <div className="flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5" />
              <span>继续 10 轮</span>
            </div>
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
