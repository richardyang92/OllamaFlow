import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export type PanelType = 'nodes' | 'properties' | 'variables' | 'files' | null

interface PanelState {
  activePanel: PanelType
  executionPanelVisible: boolean
  executionPanelCollapsed: boolean
  manuallyClosedPanels: Set<string>
  setActivePanel: (panel: PanelType) => void
  toggleExecutionPanel: () => void
  toggleExecutionCollapse: () => void
  markPanelManuallyClosed: (panel: string) => void
  isPanelManuallyClosed: (panel: string) => boolean
}

const PanelContext = createContext<PanelState | undefined>(undefined)

export function usePanelContext() {
  const context = useContext(PanelContext)
  if (!context) {
    throw new Error('usePanelContext must be used within PanelProvider')
  }
  return context
}

export function PanelProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanelState] = useState<PanelType>(null)
  const [executionPanelVisible, setExecutionPanelVisible] = useState(false)
  const [executionPanelCollapsed, setExecutionPanelCollapsed] = useState(false)
  const [manuallyClosedPanels, setManuallyClosedPanels] = useState<Set<string>>(new Set())

  // setActivePanel wrapper to clear manually closed when opening
  const setActivePanel = useCallback((panel: PanelType) => {
    setActivePanelState(panel)
    if (panel) {
      setManuallyClosedPanels(prev => {
        const next = new Set(prev)
        next.delete(panel)
        return next
      })
    }
  }, [])

  const toggleExecutionPanel = useCallback(() => {
    setExecutionPanelVisible(prev => !prev)
    if (!executionPanelVisible) {
      // When opening execution panel, clear its manually closed status
      setManuallyClosedPanels(prev => {
        const next = new Set(prev)
        next.delete('execution')
        return next
      })
    }
  }, [executionPanelVisible])

  const toggleExecutionCollapse = useCallback(() => {
    setExecutionPanelCollapsed(prev => !prev)
  }, [])

  const markPanelManuallyClosed = useCallback((panel: string) => {
    setManuallyClosedPanels(prev => new Set(prev).add(panel))
  }, [])

  const isPanelManuallyClosed = useCallback((panel: string) => {
    return manuallyClosedPanels.has(panel)
  }, [manuallyClosedPanels])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModPressed = e.metaKey || e.ctrlKey

      // Cmd+1: Nodes panel
      if (isModPressed && e.key === '1') {
        e.preventDefault()
        setActivePanel(activePanel === 'nodes' ? null : 'nodes')
      }
      // Cmd+2: Properties panel
      else if (isModPressed && e.key === '2') {
        e.preventDefault()
        setActivePanel(activePanel === 'properties' ? null : 'properties')
      }
      // Cmd+3: Variables panel
      else if (isModPressed && e.key === '3') {
        e.preventDefault()
        setActivePanel(activePanel === 'variables' ? null : 'variables')
      }
      // Cmd+4: Files panel
      else if (isModPressed && e.key === '4') {
        e.preventDefault()
        setActivePanel(activePanel === 'files' ? null : 'files')
      }
      // Cmd+5: Execution panel
      else if (isModPressed && e.key === '5') {
        e.preventDefault()
        toggleExecutionPanel()
      }
      // Cmd+0: Close all panels
      else if (isModPressed && e.key === '0') {
        e.preventDefault()
        setActivePanel(null)
        setExecutionPanelVisible(false)
      }
      // Esc: Close current sidebar panel
      else if (e.key === 'Escape' && activePanel) {
        setActivePanel(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePanel, toggleExecutionPanel, setActivePanel])

  const value: PanelState = {
    activePanel,
    executionPanelVisible,
    executionPanelCollapsed,
    manuallyClosedPanels,
    setActivePanel,
    toggleExecutionPanel,
    toggleExecutionCollapse,
    markPanelManuallyClosed,
    isPanelManuallyClosed,
  }

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
}
