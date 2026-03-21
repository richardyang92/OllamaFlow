import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentFloatingButtonProps {
  onClick: () => void
}

// Local storage key for first-time user guidance
const GUIDE_DISMISSED_KEY = 'ollamaflow-agent-guide-dismissed'

export function AgentFloatingButton({ onClick }: AgentFloatingButtonProps) {
  const [showGuide, setShowGuide] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    // Check if user has seen the guide before
    const dismissed = localStorage.getItem(GUIDE_DISMISSED_KEY)
    if (!dismissed) {
      // Show guide after a short delay for better UX
      const timer = setTimeout(() => setShowGuide(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const dismissGuide = () => {
    setShowGuide(false)
    localStorage.setItem(GUIDE_DISMISSED_KEY, 'true')
  }

  return (
    <>
      {/* First-time user guide tooltip */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={cn(
              'fixed bottom-28 right-8 z-20',
              'max-w-[240px] p-4 rounded-2xl',
              'glass-floating',
              'border border-[var(--color-border)]',
              'shadow-xl shadow-blue-500/10'
            )}
          >
            {/* Close button */}
            <button
              onClick={dismissGuide}
              className={cn(
                'absolute -top-2 -right-2 p-1 rounded-full',
                'bg-[var(--color-bg-secondary)]',
                'border border-[var(--color-border)]',
                'text-[var(--color-text-muted)]',
                'hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]',
                'transition-colors cursor-pointer'
              )}
            >
              <X className="w-3 h-3" />
            </button>

            {/* Content */}
            <div className="flex items-start gap-3">
              <div className={cn(
                'flex-shrink-0 p-2 rounded-xl',
                'bg-[var(--color-bg-input)]',
                'border border-[var(--color-border-subtle)]'
              )}>
                <Sparkles className="w-5 h-5 text-[var(--color-text-muted)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text)] mb-1">
                  AI 助手
                </p>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  点击这里与 AI 对话，让它帮你完成任务
                </p>
              </div>
            </div>

            {/* Arrow pointing to button */}
            <div className={cn(
              'absolute -bottom-2 right-8',
              'w-4 h-4 rotate-45',
              'glass-floating',
              'border-r border-b border-[var(--color-border)]'
            )} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button with label */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={onClick}
        className={cn(
          'fixed bottom-8 right-8 z-10',
          'cursor-pointer',
          'group',
          'flex items-center gap-0'
        )}
      >
        {/* Expandable label - shows on hover or when guide is visible */}
        <AnimatePresence>
          {(isHovered || showGuide) && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={cn(
                'mr-3 px-4 py-2 rounded-full',
                'glass-floating',
                'border border-[var(--color-border)]',
                'whitespace-nowrap',
                'text-sm font-medium text-[var(--color-text)]'
              )}>
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[var(--color-text-muted)]" />
                  AI 助手
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Outer glow ring - subtle */}
        <div className={cn(
          'absolute inset-0 rounded-full',
          'bg-[var(--color-accent)]',
          'opacity-10 blur-lg',
          'group-hover:opacity-20 group-hover:blur-xl',
          'transition-all duration-300',
          'scale-150'
        )} />

        {/* Main button */}
        <motion.div
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'relative p-4 rounded-full',
            'bg-[var(--color-accent)]',
            'shadow-lg',
            'group-hover:shadow-xl',
            'transition-all duration-300'
          )}
        >
          {/* Inner shine */}
          <div className={cn(
            'absolute inset-0 rounded-full',
            'bg-gradient-to-br from-white/20 via-transparent to-transparent'
          )} />

          {/* Icon - changed to MessageCircle for clarity */}
          <MessageCircle className={cn(
            'w-6 h-6 relative z-10',
            'text-white',
            'group-hover:scale-110',
            'transition-transform duration-300'
          )} />

          {/* Subtle ring animation */}
          <motion.div
            className={cn(
              'absolute inset-0 rounded-full',
              'border border-[var(--color-accent)]/30'
            )}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.3, 0, 0.3]
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />

          {/* Notification dot - subtle indicator */}
          <div className={cn(
            'absolute -top-1 -right-1 w-3 h-3 rounded-full',
            'bg-[var(--color-node-output)]',
            'border-2 border-[var(--color-bg)]'
          )} />
        </motion.div>
      </motion.div>
    </>
  )
}
