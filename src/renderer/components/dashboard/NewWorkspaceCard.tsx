import { motion } from 'framer-motion'
import { Plus, Sparkles, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NewWorkspaceCardProps {
  onClick: () => void
  isLoading?: boolean
}

export function NewWorkspaceCard({ onClick, isLoading = false }: NewWorkspaceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.01, y: -4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'relative rounded-2xl cursor-pointer overflow-hidden',
        'border border-[var(--color-border-subtle)]',
        'bg-[var(--color-bg-card)]/50',
        'backdrop-blur-sm',
        'hover:border-[var(--color-border)]',
        'hover:bg-[var(--color-bg-hover)]/50',
        'transition-all duration-300',
        'group',
        isLoading && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Top accent line - subtle */}
      <div className={cn(
        'h-0.5 w-full',
        'bg-gradient-to-r from-transparent via-[var(--color-border-subtle)] to-transparent',
        'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
      )} />

      <div className="p-5 flex items-center" style={{ minHeight: '172px' }}>
        {/* Icon with liquid glass effect */}
        <div className={cn(
          'relative w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0',
          'bg-[var(--color-bg-input)]',
          'group-hover:bg-[var(--color-bg-hover)]',
          'transition-all duration-300',
          'border border-[var(--color-border-subtle)]'
        )}>
          {/* Inner highlight */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Plus className={cn(
            'w-7 h-7 relative z-10',
            'text-[var(--color-text-muted)]',
            'group-hover:text-[var(--color-accent)]',
            'transition-colors duration-300'
          )} />

          {/* Animated ring */}
          <motion.div
            className="absolute inset-0 rounded-xl border border-[var(--color-border-subtle)]"
            initial={{ scale: 1, opacity: 0 }}
            whileHover={{ scale: 1.1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Text content */}
        <div className="flex flex-col gap-1 ml-4">
          <span className={cn(
            'text-base font-semibold',
            'text-[var(--color-text)]',
            'flex items-center gap-2',
            'transition-colors duration-200'
          )}>
            新建项目
            <ArrowRight className={cn(
              'w-4 h-4 opacity-0 -translate-x-2',
              'group-hover:opacity-100 group-hover:translate-x-0',
              'transition-all duration-300',
              'text-[var(--color-accent)]'
            )} />
          </span>
          <span className={cn(
            'text-xs',
            'text-[var(--color-text-muted)]',
            'flex items-center gap-1.5'
          )}>
            <Sparkles className="w-3 h-3 text-[var(--color-text-subtle)]" />
            创建一个新的工作流
          </span>
        </div>
      </div>
    </motion.div>
  )
}
