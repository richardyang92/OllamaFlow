import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, Layers } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import ExecutionLogPanel from './ExecutionLogPanel'
import SubAgentDetailsDrawer from './SubAgentDetailsDrawer'

export type AgentSidePanelTab = 'logs' | 'subagent'

interface AgentSidePanelProps {
  visible: boolean
  activeTab: AgentSidePanelTab
  onTabChange: (tab: AgentSidePanelTab) => void
  onClose: () => void
}

const tabs: { id: AgentSidePanelTab; label: string; icon: typeof FileText }[] = [
  { id: 'logs', label: '日志', icon: FileText },
  { id: 'subagent', label: 'SubAgent', icon: Layers },
]

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: (typeof tabs)[0]
  active: boolean
  onClick: () => void
}) {
  const Icon = tab.icon

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 justify-center px-3 py-1.5 rounded-lg text-xs font-medium',
        'transition-all duration-200',
        active
          ? 'bg-gradient-to-r from-purple-500/60 to-blue-500/60 text-white shadow-sm'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]'
      )}
      title={tab.label}
    >
      <Icon className="w-4 h-4" />
      <span>{tab.label}</span>
    </motion.button>
  )
}

export function AgentSidePanel({
  visible,
  activeTab,
  onTabChange,
  onClose,
}: AgentSidePanelProps) {
  const { resolvedTheme } = useTheme()

  // Dynamic glow shadow based on theme
  const isDark = resolvedTheme === 'dark'
  const glowColor = isDark ? '255,255,255' : '0,0,0'
  const shadowValue = `0 0 30px rgba(${glowColor},0.08), 0 0 60px rgba(${glowColor},0.04)`

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{
            duration: 0.25,
            ease: [0.4, 0, 0.2, 1] // Material Design 标准缓动
          }}
          style={{ boxShadow: shadowValue }}
          className={cn(
            'absolute right-0 top-0 bottom-0 z-30 flex flex-col',
            'bg-[var(--color-bg-elevated)]/95 backdrop-blur-xl',
            'border-l border-[var(--color-border)]',
            'overflow-hidden'
          )}
        >
          {/* Gradient accent bar at top */}
          <div
            className={cn(
              'h-1 w-full flex-shrink-0',
              'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500',
              'opacity-70'
            )}
          />

          {/* Tab bar */}
          <div className="flex items-center gap-1 px-3 py-2.5 border-b border-[var(--color-border-subtle)]">
            {tabs.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                active={activeTab === tab.id}
                onClick={() => onTabChange(tab.id)}
              />
            ))}
            <div className="flex-1" />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-full',
                'text-[var(--color-text-muted)]',
                'hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]',
                'transition-all duration-200'
              )}
              title="关闭面板"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'logs' && (
              <div className="h-full">
                <ExecutionLogPanel />
              </div>
            )}
            {activeTab === 'subagent' && (
              <div className="h-full">
                <SubAgentDetailsDrawer />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
