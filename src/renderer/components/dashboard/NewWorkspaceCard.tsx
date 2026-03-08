import { motion } from 'framer-motion'
import { Plus, Sparkles } from 'lucide-react'
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
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'rounded-2xl cursor-pointer overflow-hidden',
        'border-2 border-dashed border-[var(--color-border-subtle)]',
        'hover:border-purple-500/50',
        'hover:bg-purple-500/5',
        'transition-all duration-300',
        'group',
        isLoading && 'opacity-50 pointer-events-none'
      )}
    >
      {/* 顶部装饰条占位 */}
      <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-purple-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-6 min-h-[168px] flex items-center justify-center">
        <div className="flex items-center gap-5">
          {/* 左侧图标 */}
          <div className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0',
            'bg-[var(--color-bg-hover)]',
            'group-hover:bg-purple-500/20',
            'transition-all duration-300',
            'shadow-lg group-hover:shadow-purple-500/20'
          )}>
            <Plus className={cn(
              'w-8 h-8',
              'text-[var(--color-text-muted)]',
              'group-hover:text-purple-400',
              'transition-colors duration-300'
            )} />
          </div>

          {/* 右侧文字 */}
          <div className="flex flex-col gap-1">
            <span className={cn(
              'text-lg font-semibold',
              'text-[var(--color-text)]',
              'transition-colors duration-200'
            )}>
              新建项目
            </span>
            <span className={cn(
              'text-sm',
              'text-[var(--color-text-muted)]',
              'flex items-center gap-1.5'
            )}>
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              创建一个新的工作流
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
