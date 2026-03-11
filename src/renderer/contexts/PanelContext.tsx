import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export type PanelType = 'nodes' | 'properties' | 'variables' | 'files' | null
export type SidePanelTab = 'nodes' | 'properties' | 'variables' | 'files' | 'execution'

interface PanelState {
  activePanel: PanelType
  executionPanelVisible: boolean
  executionPanelCollapsed: boolean
  manuallyClosedPanels: Set<string>
  // New side panel state
  sidePanelVisible: boolean
  sidePanelTab: SidePanelTab
  setActivePanel: (panel: PanelType) => void
  toggleExecutionPanel: () => void
  toggleExecutionCollapse: () => void
  markPanelManuallyClosed: (panel: string) => void
  isPanelManuallyClosed: (panel: string) => boolean
  // New side panel methods
  setSidePanelVisible: (visible: boolean) => void
  setSidePanelTab: (tab: SidePanelTab) => void
  toggleSidePanel: () => void
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
  // New side panel state
  const [sidePanelVisible, setSidePanelVisible] = useState(false)
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('nodes')

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

  // Toggle side panel
  const toggleSidePanel = useCallback(() => {
    setSidePanelVisible(prev => !prev)
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModPressed = e.metaKey || e.ctrlKey

      // Helper to toggle side panel tab
      const toggleTab = (tab: SidePanelTab) => {
        if (sidePanelVisible && sidePanelTab === tab) {
          setSidePanelVisible(false)
        } else {
          setSidePanelTab(tab)
          setSidePanelVisible(true)
        }
      }

      // Cmd+1: Nodes panel
      if (isModPressed && e.key === '1') {
        e.preventDefault()
        toggleTab('nodes')
      }
      // Cmd+2: Properties panel
      else if (isModPressed && e.key === '2') {
        e.preventDefault()
        toggleTab('properties')
      }
      // Cmd+3: Variables panel
      else if (isModPressed && e.key === '3') {
        e.preventDefault()
        toggleTab('variables')
      }
      // Cmd+4: Files panel
      else if (isModPressed && e.key === '4') {
        e.preventDefault()
        toggleTab('files')
      }
      // Cmd+5: Execution panel (now in side panel)
      else if (isModPressed && e.key === '5') {
        e.preventDefault()
        toggleTab('execution')
      }
      // Cmd+0: Close all panels
      else if (isModPressed && e.key === '0') {
        e.preventDefault()
        setSidePanelVisible(false)
        setExecutionPanelVisible(false)
      }
      // Esc: Close side panel
      else if (e.key === 'Escape' && sidePanelVisible) {
        setSidePanelVisible(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidePanelVisible, sidePanelTab, setExecutionPanelVisible])

  const value: PanelState = {
    activePanel,
    executionPanelVisible,
    executionPanelCollapsed,
    manuallyClosedPanels,
    // New side panel state
    sidePanelVisible,
    sidePanelTab,
    setActivePanel,
    toggleExecutionPanel,
    toggleExecutionCollapse,
    markPanelManuallyClosed,
    isPanelManuallyClosed,
    // New side panel methods
    setSidePanelVisible,
    setSidePanelTab,
    toggleSidePanel,
  }

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
}
