import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { usePanelContext } from '@/contexts/PanelContext'
import NodePalette from './NodePalette'
import PropertiesPanel from './PropertiesPanel'
import VariableBrowser from './VariableBrowser'
import WorkspaceFiles, { type FileItem } from './WorkspaceFiles'
import { cn } from '@/lib/utils'

export function FloatingSidebar({ onFileClick }: { onFileClick?: (file: FileItem) => void }) {
  const { activePanel, setActivePanel, markPanelManuallyClosed } = usePanelContext()

  const handleClose = () => {
    if (activePanel) {
      markPanelManuallyClosed(activePanel)
    }
    setActivePanel(null)
  }

  if (!activePanel) return null

  return (
    <AnimatePresence>
      <motion.aside
        key={activePanel}
        initial={{ opacity: 0, x: -20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -20, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className={cn(
          'fixed left-20 top-16 bottom-4 w-80 z-30',
          'glass-panel rounded-glass-lg',
          'flex flex-col overflow-hidden'
        )}
      >
        {/* NodePalette and PropertiesPanel have their own headers in isDrawer mode */}
        {activePanel === 'nodes' && <NodePalette isDrawer onClose={handleClose} />}
        {activePanel === 'properties' && <PropertiesPanel isDrawer onClose={handleClose} />}

        {/* VariableBrowser needs a header wrapper */}
        {activePanel === 'variables' && (
          <>
            <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--color-text)]">变量</h2>
              <button
                onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-input)] transition-all"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <VariableBrowser />
            </div>
          </>
        )}

        {/* Files panel needs a header wrapper */}
        {activePanel === 'files' && (
          <>
            <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--color-text)]">文件</h2>
              <button
                onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-input)] transition-all"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <WorkspaceFiles
                onClose={handleClose}
                onFileClick={onFileClick}
                isDrawer
              />
            </div>
          </>
        )}
      </motion.aside>
    </AnimatePresence>
  )
}
