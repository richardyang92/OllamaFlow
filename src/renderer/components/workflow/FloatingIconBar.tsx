import { useState } from 'react'
import { Blocks, Settings, Variable, FileText, FolderOpen, LayoutGrid } from 'lucide-react'
import { usePanelContext } from '@/contexts/PanelContext'
import { useTheme } from '@/contexts/ThemeContext'
import { IconButton } from './IconButton'
import { cn } from '@/lib/utils'

interface IconBarButton {
  id: string
  icon: typeof Blocks
  tooltip: string
  panel: 'nodes' | 'properties' | 'variables' | 'files'
}

export function FloatingIconBar() {
  const { activePanel, setActivePanel, executionPanelVisible, toggleExecutionPanel } = usePanelContext()
  const { resolvedTheme } = useTheme()
  const [isHovered, setIsHovered] = useState(false)

  const buttons: IconBarButton[] = [
    { id: 'nodes', icon: Blocks, tooltip: '节点面板 (⌘1)', panel: 'nodes' },
    { id: 'properties', icon: Settings, tooltip: '属性面板 (⌘2)', panel: 'properties' },
    { id: 'variables', icon: Variable, tooltip: '变量面板 (⌘3)', panel: 'variables' },
    { id: 'files', icon: FolderOpen, tooltip: '文件面板 (⌘4)', panel: 'files' },
  ]

  // Keep expanded when sidebar is open or hovered
  const isExpanded = isHovered || activePanel !== null

  // Dynamic glow shadow based on theme (same as FloatingToolbar)
  const isDark = resolvedTheme === 'dark'
  const glowColor = isDark ? '255,255,255' : '0,0,0'
  const shadowValue = isExpanded
    ? `0 0 30px rgba(${glowColor},0.1), 0 0 60px rgba(${glowColor},0.05)`
    : `0 0 20px rgba(${glowColor},0.05)`

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        boxShadow: shadowValue,
      }}
      className={cn(
        'fixed left-4 top-16 z-40',
        'rounded-glass-lg',
        'transition-all duration-200',
        'flex flex-col items-center',
        isExpanded
          ? 'bg-[var(--color-bg-elevated)]/80 backdrop-blur-xl h-auto max-h-[calc(100vh-120px)] w-12 py-3 gap-2'
          : 'bg-[var(--color-bg-elevated)]/5 backdrop-blur-sm h-12 w-12'
      )}
    >
      {isExpanded ? (
        <>
          {/* Panel buttons */}
          {buttons.map(({ id, icon: Icon, tooltip, panel }) => (
            <IconButton
              key={id}
              icon={Icon}
              tooltip={tooltip}
              active={activePanel === panel}
              onClick={() => setActivePanel(activePanel === panel ? null : panel)}
            />
          ))}

          <div className="flex-1 min-h-[8px]" />

          {/* Execution panel toggle */}
          <IconButton
            icon={FileText}
            tooltip="执行日志 (⌘5)"
            active={executionPanelVisible}
            onClick={toggleExecutionPanel}
          />
        </>
      ) : (
        <div className="flex items-center justify-center h-full w-full">
          <LayoutGrid className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </div>
      )}
    </div>
  )
}
