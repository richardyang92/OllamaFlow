import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useCallback } from 'react'
import { AlertTriangle, Info, AlertCircle } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

const variantConfig = {
  danger: {
    icon: AlertTriangle,
    iconColor: 'text-red-400',
    confirmButtonClass: 'bg-red-600 hover:bg-red-500',
  },
  warning: {
    icon: AlertCircle,
    iconColor: 'text-yellow-400',
    confirmButtonClass: 'bg-yellow-600 hover:bg-yellow-500',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-400',
    confirmButtonClass: 'bg-blue-600 hover:bg-blue-500',
  },
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'info',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel()
    }
  }, [onCancel])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md bg-[var(--color-bg-panel)] backdrop-blur-xl rounded-xl border border-[var(--color-border-subtle)] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--color-bg-hover)]`}>
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                </div>
                <h2 className="text-lg font-medium text-[var(--color-text)]">{title}</h2>
              </div>
            </div>

            {/* Content */}
            <div className="px-5 py-4">
              <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-line">
                {message}
              </p>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--color-border-subtle)] flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-input)] rounded-lg transition-all"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 text-sm text-white rounded-lg transition-all font-medium ${config.confirmButtonClass}`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
