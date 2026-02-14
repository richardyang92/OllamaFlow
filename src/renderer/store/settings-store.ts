import { create } from 'zustand'

interface OllamaConnection {
  id: string
  name: string
  host: string
  isDefault: boolean
}

interface SettingsState {
  connections: OllamaConnection[]
  activeConnectionId: string | null

  // Actions
  addConnection: (connection: OllamaConnection) => void
  updateConnection: (id: string, data: Partial<OllamaConnection>) => void
  deleteConnection: (id: string) => void
  setActiveConnection: (id: string) => void
  getDefaultConnection: () => OllamaConnection | undefined
  getActiveConnection: () => OllamaConnection | undefined
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  connections: [
    {
      id: 'default',
      name: 'Local Ollama',
      host: 'http://127.0.0.1:11434',
      isDefault: true,
    },
  ],
  activeConnectionId: 'default',

  addConnection: (connection) => {
    set({
      connections: [...get().connections, connection],
    })
  },

  updateConnection: (id, data) => {
    set({
      connections: get().connections.map((conn) =>
        conn.id === id ? { ...conn, ...data } : conn
      ),
    })
  },

  deleteConnection: (id) => {
    if (id === 'default') return // Cannot delete default connection
    set({
      connections: get().connections.filter((conn) => conn.id !== id),
      activeConnectionId:
        get().activeConnectionId === id ? 'default' : get().activeConnectionId,
    })
  },

  setActiveConnection: (id) => {
    set({ activeConnectionId: id })
  },

  getDefaultConnection: () => {
    return get().connections.find((conn) => conn.isDefault)
  },

  getActiveConnection: () => {
    const { connections, activeConnectionId } = get()
    return connections.find((conn) => conn.id === activeConnectionId)
  },
}))
