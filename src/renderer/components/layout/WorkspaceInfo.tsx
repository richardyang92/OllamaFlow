import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExecutionStatus } from '@/types/execution'
import { WorkspaceEditDialog } from '@/components/workflow/WorkspaceEditDialog'

interface WorkspaceInfoProps {
  name: string
  description?: string
  isDirty: boolean
  executionStatus: ExecutionStatus
  onEditInfo?: (name: string, description: string) => void
}

function StatusIndicator({
  isDirty,
  executionStatus,
}: {
  isDirty: boolean
  executionStatus: ExecutionStatus
}) {
  const getStatusStyle = () => {
    switch (executionStatus) {
      case 'running':
        return {
          className: 'bg-yellow-400',
          animate: { opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] },
          repeat: Infinity,
        }
      case 'completed':
        return {
          className: 'bg-green-400',
          animate: { opacity: 1, scale: 1 },
          repeat: 0,
        }
      case 'failed':
      case 'cancelled':
        return {
          className: 'bg-red-400',
          animate: { opacity: 1, scale: 1 },
          repeat: 0,
        }
      case 'idle':
      default:
        if (isDirty) {
          return {
            className: 'bg-yellow-400',
            animate: { opacity: [0.5, 1, 0.5] },
            repeat: Infinity,
          }
        }
        return {
          className: 'bg-gray-400',
          animate: { opacity: 1, scale: 1 },
          repeat: 0,
        }
    }
  }

  const { className, animate, repeat } = getStatusStyle()

  return (
    <motion.span
      animate={animate}
      transition={{ duration: 2, repeat }}
      className={cn('w-2 h-2 rounded-full flex-shrink-0', className)}
    />
  )
}

export function WorkspaceInfo({
  name,
  description,
  isDirty,
  executionStatus,
  onEditInfo,
}: WorkspaceInfoProps) {
  const [showEditDialog, setShowEditDialog] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2 px-2">
        <span className="text-sm font-medium max-w-32 truncate text-[var(--color-text)]">
          {name}
        </span>
        <StatusIndicator isDirty={isDirty} executionStatus={executionStatus} />
        {onEditInfo && (
          <motion.button
            onClick={() => setShowEditDialog(true)}
            className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center',
              'text-[var(--color-text-muted)]',
              'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
              'transition-all duration-200'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="编辑 SubAgent 信息"
          >
            <Pencil className="w-3 h-3" />
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {showEditDialog && onEditInfo && (
          <WorkspaceEditDialog
            name={name}
            description={description || ''}
            onSubmit={(newName, newDescription) => {
              onEditInfo(newName, newDescription)
              setShowEditDialog(false)
            }}
            onCancel={() => setShowEditDialog(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
