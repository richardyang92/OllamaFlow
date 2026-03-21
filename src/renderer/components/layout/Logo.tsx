import { motion } from 'framer-motion'
import { Bot, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  compact?: boolean
  onBack?: () => void
}

export function Logo({ compact = false, onBack }: LogoProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('flex items-center gap-2.5 flex-shrink-0')}
    >
      {onBack && (
        <motion.button
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={onBack}
          title="关闭工作区"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full',
            'text-[var(--color-text-muted)] text-xs font-medium',
            'bg-[var(--color-bg-input)]',
            'border border-[var(--color-border-subtle)]',
            'hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-border)]',
            'hover:text-[var(--color-accent)]',
            'transition-all duration-200 cursor-pointer'
          )}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>返回</span>
        </motion.button>
      )}
      <div
        className={cn(
          'rounded-lg flex items-center justify-center',
          'bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)]',
          compact ? 'w-8 h-8' : 'w-9 h-9 rounded-xl'
        )}
      >
        <Bot className={cn('text-[var(--color-text-muted)]', compact ? 'w-4 h-4' : 'w-5 h-5')} />
      </div>
      <h1
        className={cn(
          'font-semibold text-[var(--color-text)]',
          compact ? 'text-base' : 'text-lg font-bold'
        )}
      >
        OllamaFlow
      </h1>
    </motion.div>
  )
}
