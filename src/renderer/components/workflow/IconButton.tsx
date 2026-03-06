import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface IconButtonProps {
  icon: LucideIcon
  tooltip?: string
  active?: boolean
  onClick?: () => void
  className?: string
}

export function IconButton({ icon: Icon, tooltip, active = false, onClick, className }: IconButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      title={tooltip}
      className={cn(
        'w-9 h-9 rounded-lg',
        'flex items-center justify-center',
        'text-[var(--color-text-muted)]',
        'hover:text-[var(--color-text)]',
        'hover:bg-[var(--color-bg-input)]/50',
        'transition-all duration-200',
        active && 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]',
        className
      )}
    >
      <Icon className="w-[18px] h-[18px]" />
    </motion.button>
  )
}
