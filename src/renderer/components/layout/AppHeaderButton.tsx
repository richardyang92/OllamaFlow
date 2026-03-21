import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { AppHeaderButtonProps } from './types'

export function AppHeaderButton({
  icon: Icon,
  onClick,
  disabled = false,
  tooltip,
  variant = 'default',
  showLabel = false,
  label,
  badge,
  className,
}: AppHeaderButtonProps) {
  const baseStyles = cn(
    'flex items-center gap-1.5 rounded-lg text-xs font-medium',
    'transition-all duration-200',
    disabled && 'opacity-50 cursor-not-allowed'
  )

  const variantStyles = {
    default: cn(
      'px-2.5 py-1.5',
      'text-[var(--color-text-muted)]',
      'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
    ),
    primary: cn(
      'px-2.5 py-1.5',
      'bg-[var(--color-accent)] text-white',
      'hover:bg-[var(--color-accent-hover)]'
    ),
    danger: cn(
      'px-2.5 py-1.5',
      'bg-red-500/80 text-white',
      'hover:bg-red-500'
    ),
    active: cn(
      'px-2.5 py-1.5',
      'bg-[var(--color-bg-input)] text-[var(--color-text)]'
    ),
  }

  // 纯图标按钮样式
  const iconOnlyStyles = cn(
    'w-8 h-8 justify-center',
    'text-[var(--color-text-muted)]',
    'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
  )

  const isIconOnly = !showLabel && !label

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={cn(
        baseStyles,
        isIconOnly ? iconOnlyStyles : variantStyles[variant],
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {showLabel && label && <span className="hidden sm:inline">{label}</span>}
      {badge}
    </motion.button>
  )
}
