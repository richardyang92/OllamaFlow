import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface WorkspaceGridProps {
  children: ReactNode
}

export function WorkspaceGrid({ children }: WorkspaceGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className={`
        max-w-5xl mx-auto
        grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3
        gap-4 px-6 pb-24
      `}
    >
      {children}
    </motion.div>
  )
}
