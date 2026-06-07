import { motion } from 'framer-motion'
import { FolderOpen, FileDown, Loader2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AddWorkspaceCardProps {
  onOpenFolder: () => void
  onImportFile: () => void
  isLoading?: boolean
  isImporting?: boolean
}

export function AddWorkspaceCard({
  onOpenFolder,
  onImportFile,
  isLoading = false,
  isImporting = false
}: AddWorkspaceCardProps) {
  const handleMainClick = () => {
    if (!isLoading && !isImporting) {
      onOpenFolder()
    }
  }

  const disabled = isLoading || isImporting

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: disabled ? 1 : 1.01, y: disabled ? 0 : -4 }}
      whileTap={{ scale: disabled ? 1 : 0.99 }}
      className={cn(
        'relative rounded-2xl overflow-hidden',
        'border border-[var(--color-border-subtle)]',
        'bg-[var(--color-bg-card)]/50',
        'backdrop-blur-sm',
        'hover:border-[var(--color-border)]',
        'hover:bg-[var(--color-bg-hover)]/50',
        'transition-all duration-300',
        'group',
        disabled && 'opacity-50'
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

          {isLoading || isImporting ? (
            <Loader2 className="w-7 h-7 text-[var(--color-accent)] animate-spin relative z-10" />
          ) : (
            <FolderOpen className={cn(
              'w-7 h-7 relative z-10',
              'text-[var(--color-text-muted)]',
              'group-hover:text-[var(--color-accent)]',
              'transition-colors duration-300'
            )} />
          )}

          {/* Animated ring */}
          <motion.div
            className="absolute inset-0 rounded-xl border border-[var(--color-border-subtle)]"
            initial={{ scale: 1, opacity: 0 }}
            whileHover={{ scale: 1.1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Text content */}
        <div className="flex flex-col gap-1.5 ml-4">
          <span className={cn(
            'text-base font-semibold',
            'text-[var(--color-text)]',
            'flex items-center gap-2',
            'transition-colors duration-200'
          )}>
            添加项目
            <ArrowRight className={cn(
              'w-4 h-4 opacity-0 -translate-x-2',
              'group-hover:opacity-100 group-hover:translate-x-0',
              'transition-all duration-300',
              'text-[var(--color-accent)]'
            )} />
          </span>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <motion.button
              onClick={handleMainClick}
              disabled={disabled}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium',
                'text-[var(--color-text-muted)]',
                'hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]',
                'transition-all duration-200',
                'disabled:cursor-not-allowed'
              )}
              whileHover={{ scale: disabled ? 1 : 1.02 }}
              whileTap={{ scale: disabled ? 1 : 0.98 }}
            >
              <FolderOpen className="w-3 h-3" />
              <span>打开目录</span>
            </motion.button>

            <span className="text-[var(--color-text-subtle)] text-xs">或</span>

            <motion.button
              onClick={onImportFile}
              disabled={disabled}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium',
                'text-[var(--color-text-muted)]',
                'hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]',
                'transition-all duration-200',
                'disabled:cursor-not-allowed'
              )}
              whileHover={{ scale: disabled ? 1 : 1.02 }}
              whileTap={{ scale: disabled ? 1 : 0.98 }}
            >
              <FileDown className="w-3 h-3" />
              <span>{isImporting ? '导入中...' : '导入文件'}</span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
