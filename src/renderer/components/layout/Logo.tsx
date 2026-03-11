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
            'bg-gradient-to-r from-violet-500/10 to-purple-500/10',
            'border border-violet-500/20',
            'hover:from-violet-500/20 hover:to-purple-500/20',
            'hover:border-violet-500/30 hover:text-purple-400',
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
          'bg-gradient-to-br from-violet-500/20 to-purple-500/20',
          compact ? 'w-8 h-8' : 'w-9 h-9 rounded-xl shadow-sm'
        )}
      >
        <Bot className={cn('text-purple-400', compact ? 'w-4 h-4' : 'w-5 h-5')} />
      </div>
      <h1
        className={cn(
          'font-semibold bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent',
          compact ? 'text-base' : 'text-lg font-bold'
        )}
      >
        OllamaFlow
      </h1>
    </motion.div>
  )
}
