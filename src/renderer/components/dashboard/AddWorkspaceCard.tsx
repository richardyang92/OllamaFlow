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
        'hover:border-blue-500/30',
        'hover:bg-blue-500/5',
        'transition-all duration-300',
        'group',
        disabled && 'opacity-50'
      )}
    >
      {/* Animated gradient glow on hover */}
      <div className={cn(
        'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300',
        'bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-teal-500/20',
        'blur-xl -z-10'
      )} />

      {/* Top accent line */}
      <div className={cn(
        'h-0.5 w-full',
        'bg-gradient-to-r from-transparent via-blue-500/40 to-transparent',
        'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
      )} />

      <div className="p-5 flex items-center" style={{ minHeight: '172px' }}>
        {/* Icon with liquid glass effect */}
        <div className={cn(
          'relative w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0',
          'bg-gradient-to-br from-blue-500/10 to-cyan-500/10',
          'group-hover:from-blue-500/20 group-hover:to-cyan-500/20',
          'transition-all duration-300',
          'shadow-sm group-hover:shadow-blue-500/10'
        )}>
          {/* Inner glow */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {isLoading || isImporting ? (
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin relative z-10" />
          ) : (
            <FolderOpen className={cn(
              'w-7 h-7 relative z-10',
              'text-[var(--color-text-muted)]',
              'group-hover:text-blue-400',
              'transition-colors duration-300'
            )} />
          )}

          {/* Animated ring */}
          <motion.div
            className="absolute inset-0 rounded-xl border border-blue-500/20"
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
            添加工作区
            <ArrowRight className={cn(
              'w-4 h-4 opacity-0 -translate-x-2',
              'group-hover:opacity-100 group-hover:translate-x-0',
              'transition-all duration-300',
              'text-blue-400'
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
                'hover:text-blue-400 hover:bg-blue-500/10',
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
                'hover:text-blue-400 hover:bg-blue-500/10',
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
