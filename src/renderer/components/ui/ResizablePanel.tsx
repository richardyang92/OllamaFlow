import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GripHorizontal, ChevronDown, ChevronUp } from 'lucide-react'

interface ResizablePanelProps {
  children: ReactNode
  defaultHeight?: number
  minHeight?: number
  maxHeight?: number
  collapsedHeight?: number
  defaultCollapsed?: boolean
  className?: string
}

export function ResizablePanel({
  children,
  defaultHeight = 200,
  minHeight = 100,
  maxHeight = 500,
  collapsedHeight = 32,
  defaultCollapsed = true,
  className = '',
}: ResizablePanelProps) {
  const [height, setHeight] = useState(defaultHeight)
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isCollapsed) return
    e.preventDefault()
    setIsResizing(true)
    startYRef.current = e.clientY
    startHeightRef.current = height
  }, [height, isCollapsed])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const deltaY = startYRef.current - e.clientY
    const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeightRef.current + deltaY))
    setHeight(newHeight)
  }, [isResizing, minHeight, maxHeight])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(!isCollapsed)
  }, [isCollapsed])

  const currentHeight = isCollapsed ? collapsedHeight : height

  return (
    <motion.div
      ref={panelRef}
      initial={false}
      animate={{ height: currentHeight }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={`relative flex flex-col ${className}`}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        onClick={toggleCollapse}
        className={`
          absolute top-0 left-0 right-0 h-6 z-10
          flex items-center justify-center
          cursor-row-resize
          group
          ${isCollapsed ? 'cursor-pointer' : ''}
        `}
      >
        <div
          className={`
            flex items-center justify-center gap-2 px-3 py-1 rounded-full
            transition-all duration-200
            ${isResizing 
              ? 'bg-[var(--color-border)]' 
              : 'bg-transparent group-hover:bg-[var(--color-bg-input)]'
            }
          `}
        >
          <GripHorizontal 
            className={`w-4 h-4 transition-colors ${
              isResizing 
                ? 'text-[var(--color-text)]' 
                : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]'
            }`}
          />
          {isCollapsed ? (
            <ChevronUp className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]" />
          ) : (
            <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]" />
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-hidden pt-6"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
