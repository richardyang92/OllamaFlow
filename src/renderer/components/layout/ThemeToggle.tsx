import { motion } from 'framer-motion'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { themeMode, setThemeMode } = useTheme()

  const handleThemeToggle = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(themeMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setThemeMode(nextMode)
  }

  const ThemeIcon = themeMode === 'system' ? Monitor : themeMode === 'dark' ? Moon : Sun
  const themeLabel = themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色'

  return (
    <motion.button
      onClick={handleThemeToggle}
      className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center',
        'text-[var(--color-text-muted)]',
        'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
        'transition-all duration-200'
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={`主题: ${themeLabel}`}
    >
      <ThemeIcon className="w-4 h-4" />
    </motion.button>
  )
}
