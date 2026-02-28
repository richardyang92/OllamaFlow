import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
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
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'p-5 rounded-xl cursor-pointer',
        'border-2 border-dashed border-[var(--color-border-subtle)]',
        'hover:border-purple-500/50',
        'hover:bg-purple-500/5',
        'transition-all duration-200',
        'group',
        'min-h-[140px]',
        'flex flex-col items-center justify-center gap-3',
        isLoading && 'opacity-50 pointer-events-none'
      )}
    >
      <div className={cn(
        'w-12 h-12 rounded-full flex items-center justify-center',
        'bg-[var(--color-bg-hover)]',
        'group-hover:bg-purple-500/20',
        'transition-all duration-200'
      )}>
        <Plus className={cn(
          'w-6 h-6',
          'text-[var(--color-text-muted)]',
          'group-hover:text-purple-400',
          'transition-colors duration-200'
        )} />
      </div>
      <span className={cn(
        'text-sm font-medium',
        'text-[var(--color-text-muted)]',
        'group-hover:text-[var(--color-text)]',
        'transition-colors duration-200'
      )}>
        新建项目
      </span>
    </motion.div>
  )
}
