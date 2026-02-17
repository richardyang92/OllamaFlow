import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface HelpTooltipProps {
  content: string
  className?: string
}

export function HelpTooltip({ content, className }: HelpTooltipProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div className={cn("relative inline-block ml-1", className)}>
      <button
        className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        ⓘ
      </button>
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute left-full ml-2 top-0 z-50 w-64 p-3 rounded-lg bg-card-bg backdrop-blur-md border border-white/10 shadow-xl"
          >
            <p className="text-xs text-gray-300">{content}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
