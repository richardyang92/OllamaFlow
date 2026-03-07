import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentFloatingButtonProps {
  onClick: () => void
}

export function AgentFloatingButton({ onClick }: AgentFloatingButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 z-10',
        'p-4 rounded-full cursor-pointer',
        'bg-gradient-to-br from-purple-500 to-blue-500',
        'shadow-lg shadow-purple-500/25',
        'hover:shadow-xl hover:shadow-purple-500/30',
        'transition-shadow duration-200',
        'group'
      )}
    >
      <Sparkles className={cn(
        'w-6 h-6',
        'text-white',
        'group-hover:rotate-12',
        'transition-transform duration-200'
      )} />
    </motion.div>
  )
}
