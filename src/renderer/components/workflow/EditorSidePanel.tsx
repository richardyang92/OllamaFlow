import { motion, AnimatePresence } from 'framer-motion'
import { X, Blocks, Settings, Variable, FolderOpen, FileText } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import NodePalette from './NodePalette'
import PropertiesPanel from './PropertiesPanel'
import VariableBrowser from './VariableBrowser'
import WorkspaceFiles, { type FileItem } from './WorkspaceFiles'
import ExecutionPanel from './ExecutionPanel'
import { cn } from '@/lib/utils'
import type { SidePanelTab } from '@/contexts/PanelContext'

interface EditorSidePanelProps {
  visible: boolean
  activeTab: SidePanelTab
  onTabChange: (tab: SidePanelTab) => void
  onClose: () => void
  onFileClick?: (file: FileItem) => void
}

const tabs: { id: SidePanelTab; label: string; icon: typeof Blocks }[] = [
  { id: 'nodes', label: '节点', icon: Blocks },
  { id: 'properties', label: '属性', icon: Settings },
  { id: 'variables', label: '变量', icon: Variable },
  { id: 'files', label: '文件', icon: FolderOpen },
  { id: 'execution', label: '日志', icon: FileText },
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
        'flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium',
        'transition-all duration-200',
        active
          ? 'bg-gradient-to-r from-purple-500/60 to-blue-500/60 text-white shadow-sm'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]'
      )}
      title={tab.label}
    >
      <Icon className="w-4 h-4" />
    </motion.button>
  )
}

export function EditorSidePanel({
  visible,
  activeTab,
  onTabChange,
  onClose,
  onFileClick,
}: EditorSidePanelProps) {
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
          transition={{ duration: 0.2, ease: 'easeInOut' }}
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
            {activeTab === 'nodes' && <NodePalette isDrawer onClose={onClose} />}
            {activeTab === 'properties' && <PropertiesPanel isDrawer onClose={onClose} />}
            {activeTab === 'variables' && (
              <div className="h-full overflow-y-auto">
                <VariableBrowser />
              </div>
            )}
            {activeTab === 'files' && (
              <div className="h-full overflow-y-auto">
                <WorkspaceFiles onClose={onClose} onFileClick={onFileClick} isDrawer />
              </div>
            )}
            {activeTab === 'execution' && (
              <div className="h-full">
                <ExecutionPanel isDrawer />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
