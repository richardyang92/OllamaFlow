import { useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type DrawerSide = 'left' | 'right'

interface CollapsibleDrawerProps {
  children: ReactNode
  side?: DrawerSide
  isOpen: boolean
  onClose?: () => void
  width?: number
  minWidth?: number
  maxWidth?: number
  className?: string
  showCloseButton?: boolean
}

export function CollapsibleDrawer({
  children,
  side = 'right',
  isOpen,
  onClose,
  width = 320,
  minWidth = 240,
  maxWidth = 480,
  className = '',
  showCloseButton = true,
}: CollapsibleDrawerProps) {
  const [currentWidth, setCurrentWidth] = useState(width)
  const [isResizing, setIsResizing] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = side === 'right'
      ? window.innerWidth - e.clientX
      : e.clientX
    setCurrentWidth(Math.min(maxWidth, Math.max(minWidth, newWidth)))
  }, [isResizing, side, minWidth, maxWidth])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  if (typeof window !== 'undefined') {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    if (!isResizing) {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }

  const variants = {
    open: {
      x: 0,
      opacity: 1,
      width: currentWidth,
    },
    closed: {
      x: side === 'right' ? 20 : -20,
      opacity: 0,
      width: 0,
    },
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.aside
            initial="closed"
            animate="open"
            exit="closed"
            variants={variants}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={cn(
              'fixed top-0 bottom-0 z-[60]',
              'glass-floating',
              'flex flex-col',
              side === 'right' ? 'right-4 rounded-l-glass-lg' : 'left-4 rounded-r-glass-lg',
              className
            )}
            style={{ top: '52px', bottom: '16px' }}
          >
            {/* Resize handle */}
            <div
              onMouseDown={handleMouseDown}
              className={cn(
                'absolute top-0 bottom-0 w-1 cursor-col-resize',
                'hover:bg-[var(--color-border)]',
                'transition-colors',
                side === 'right' ? 'left-0' : 'right-0'
              )}
            />

            {/* Close button */}
            {showCloseButton && onClose && (
              <button
                onClick={onClose}
                className={cn(
                  'absolute top-3 z-10',
                  'w-7 h-7 flex items-center justify-center',
                  'rounded-full',
                  'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                  'hover:bg-[var(--color-bg-input)]',
                  'transition-all',
                  side === 'right' ? 'left-3' : 'right-3'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

interface DrawerHeaderProps {
  title: string
  subtitle?: string
  className?: string
}

export function DrawerHeader({ title, subtitle, className = '' }: DrawerHeaderProps) {
  return (
    <div className={cn('px-4 py-3 border-b border-[var(--color-border-subtle)]', className)}>
      <h2 className="text-sm font-medium text-[var(--color-text)]">{title}</h2>
      {subtitle && (
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}

interface DrawerContentProps {
  children: ReactNode
  className?: string
}

export function DrawerContent({ children, className = '' }: DrawerContentProps) {
  return (
    <div className={cn('flex-1 overflow-y-auto p-4', className)}>
      {children}
    </div>
  )
}

interface DrawerFooterProps {
  children: ReactNode
  className?: string
}

export function DrawerFooter({ children, className = '' }: DrawerFooterProps) {
  return (
    <div className={cn('p-4 border-t border-[var(--color-border-subtle)]', className)}>
      {children}
    </div>
  )
}
