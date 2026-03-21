import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import ExecutionLogPanel from './ExecutionLogPanel'

interface AgentSidePanelProps {
  visible: boolean
  onClose: () => void
}

export function AgentSidePanel({
  visible,
  onClose,
}: AgentSidePanelProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{
            duration: 0.25,
            ease: [0.4, 0, 0.2, 1] // Material Design 标准缓动
          }}
          className={cn(
            'absolute right-0 top-0 bottom-0 z-30 flex flex-col',
            'bg-[var(--color-bg-elevated)]',
            'border-l border-[var(--color-border)]',
            'overflow-hidden'
          )}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border-subtle)]">
            <span className="text-sm font-medium text-[var(--color-text)]">执行日志</span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-full',
                'text-[var(--color-text-muted)]',
                'hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]',
                'transition-all duration-200'
              )}
              title="关闭面板"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            <ExecutionLogPanel />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
