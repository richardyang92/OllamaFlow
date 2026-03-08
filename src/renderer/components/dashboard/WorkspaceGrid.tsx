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
      className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 p-6 pt-24"
    >
      {children}
    </motion.div>
  )
}
