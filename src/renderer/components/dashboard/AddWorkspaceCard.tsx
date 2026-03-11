import { motion } from 'framer-motion'
import { FolderOpen, FileDown, Loader2 } from 'lucide-react'
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
      className={cn(
        'rounded-2xl overflow-hidden',
        'border-2 border-dashed border-[var(--color-border-subtle)]',
        'hover:border-blue-500/50',
        'hover:bg-blue-500/5',
        'transition-all duration-300',
        'group',
        disabled && 'opacity-50'
      )}
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-blue-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-6 min-h-[168px] flex items-center justify-center">
        <div className="flex items-center gap-5">
          <div className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0',
            'bg-[var(--color-bg-hover)]',
            'group-hover:bg-blue-500/20',
            'transition-all duration-300',
            'shadow-lg group-hover:shadow-blue-500/20'
          )}>
            {isLoading || isImporting ? (
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            ) : (
              <FolderOpen className={cn(
                'w-8 h-8',
                'text-[var(--color-text-muted)]',
                'group-hover:text-blue-400',
                'transition-colors duration-300'
              )} />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={cn(
              'text-lg font-semibold',
              'text-[var(--color-text)]',
              'transition-colors duration-200'
            )}>
              添加工作区
            </span>
            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleMainClick}
                disabled={disabled}
                className={cn(
                  'flex items-center gap-1.5 text-sm',
                  'text-[var(--color-text-muted)]',
                  'hover:text-blue-400',
                  'transition-colors duration-200',
                  'disabled:cursor-not-allowed'
                )}
                whileHover={{ scale: disabled ? 1 : 1.02 }}
                whileTap={{ scale: disabled ? 1 : 0.98 }}
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                <span>打开目录</span>
              </motion.button>
              <span className="text-[var(--color-text-muted)] text-sm">或</span>
              <motion.button
                onClick={onImportFile}
                disabled={disabled}
                className={cn(
                  'flex items-center gap-1.5 text-sm',
                  'text-[var(--color-text-muted)]',
                  'hover:text-blue-400',
                  'transition-colors duration-200',
                  'disabled:cursor-not-allowed'
                )}
                whileHover={{ scale: disabled ? 1 : 1.02 }}
                whileTap={{ scale: disabled ? 1 : 0.98 }}
              >
                <FileDown className="w-3.5 h-3.5 text-blue-400" />
                <span>{isImporting ? '导入中...' : '导入文件'}</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
