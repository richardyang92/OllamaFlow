import { create } from 'zustand'
import type { GlobalAIConfig, ModelInfo, ResolvedAIConfig } from '@/types/global-config'
import { useWorkflowStore } from './workflow-store'

interface OllamaConnection {
  id: string
  name: string
  host: string
  isDefault: boolean
}

interface SettingsState {
  // 现有 Ollama 连接配置
  connections: OllamaConnection[]
  activeConnectionId: string | null

  // 全局 AI 配置
  globalAIConfig: GlobalAIConfig | null
  isGlobalAIEnabled: boolean
  availableModels: ModelInfo[]
  isLoadingModels: boolean

  // Actions - Ollama 连接
  addConnection: (connection: OllamaConnection) => void
  updateConnection: (id: string, data: Partial<OllamaConnection>) => void
  deleteConnection: (id: string) => void
  setActiveConnection: (id: string) => void
  getDefaultConnection: () => OllamaConnection | undefined
  getActiveConnection: () => OllamaConnection | undefined

  // Actions - 全局 AI 配置
  loadGlobalAIConfig: () => Promise<void>
  setGlobalAIConfig: (config: GlobalAIConfig, apiKey?: string) => Promise<void>
  clearGlobalAIConfig: () => Promise<void>
  fetchModels: () => Promise<ModelInfo[]>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // 现有状态
  connections: [
    {
      id: 'default',
      name: 'Local Ollama',
      host: 'http://127.0.0.1:11434',
      isDefault: true,
    },
  ],
  activeConnectionId: 'default',

  // 全局 AI 配置状态
  globalAIConfig: null,
  isGlobalAIEnabled: false,
  availableModels: [],
  isLoadingModels: false,

  // 现有 Actions
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

  // 全局 AI 配置 Actions
  loadGlobalAIConfig: async () => {
    try {
      const config = await window.electronAPI.globalAI.getConfig()

      set({
        globalAIConfig: config,
        isGlobalAIEnabled: config?.enabled ?? false,
      })

      // 如果启用了全局配置，自动加载模型列表
      if (config?.enabled && config.apiEndpoint) {
        get().fetchModels()
      }
    } catch (error) {
      console.error('[SettingsStore] Failed to load global AI config:', error)
    }
  },

  setGlobalAIConfig: async (config, apiKey) => {
    try {
      // Get old model before update
      const oldModel = get().globalAIConfig?.defaultModel
      const newModel = config.defaultModel

      await window.electronAPI.globalAI.setConfig(config)
      if (apiKey !== undefined) {
        if (apiKey) {
          await window.electronAPI.globalAI.setApiKey(apiKey)
        } else {
          await window.electronAPI.globalAI.deleteApiKey()
        }
      }

      set({
        globalAIConfig: config,
        isGlobalAIEnabled: config.enabled,
      })

      // Sync all workflow nodes with old model to new model
      if (oldModel && newModel && oldModel !== newModel) {
        useWorkflowStore.getState().updateAllNodeModels(oldModel, newModel)
        // Auto-save the workflow to persist changes to file
        await useWorkflowStore.getState().saveCurrentWorkflow()
      }
    } catch (error) {
      console.error('[SettingsStore] Failed to save global AI config:', error)
      throw error
    }
  },

  clearGlobalAIConfig: async () => {
    try {
      await window.electronAPI.globalAI.clearConfig()
      set({
        globalAIConfig: null,
        isGlobalAIEnabled: false,
        availableModels: [],
      })
    } catch (error) {
      console.error('[SettingsStore] Failed to clear global AI config:', error)
    }
  },

  fetchModels: async () => {
    const { globalAIConfig, isGlobalAIEnabled } = get()

    if (!isGlobalAIEnabled || !globalAIConfig?.apiEndpoint) {
      return []
    }

    set({ isLoadingModels: true })

    try {
      const apiKey = await window.electronAPI.globalAI.getApiKey()
      const result = await window.electronAPI.globalAI.testConnection({
        apiEndpoint: globalAIConfig.apiEndpoint,
        apiKey: apiKey || undefined,
      })

      if (result.success && result.models) {
        set({ availableModels: result.models })
        return result.models
      }
      return []
    } catch (error) {
      console.error('[SettingsStore] Failed to fetch models:', error)
      return []
    } finally {
      set({ isLoadingModels: false })
    }
  },
}))

/**
 * 获取有效的 AI 配置（优先级逻辑）
 * 此函数用于需要同步获取配置的场景
 */
export async function getEffectiveAIConfig(): Promise<ResolvedAIConfig> {
  const settingsStore = useSettingsStore.getState()

  // 1. 全局配置优先
  if (settingsStore.isGlobalAIEnabled && settingsStore.globalAIConfig) {
    const globalApiKey = await window.electronAPI.globalAI.getApiKey()
    return {
      apiEndpoint: settingsStore.globalAIConfig.apiEndpoint,
      apiKey: globalApiKey || undefined,
      defaultModel: settingsStore.globalAIConfig.defaultModel,
      source: 'global',
    }
  }

  // 2. 返回默认配置（由调用方处理工作区/节点级别配置）
  return {
    apiEndpoint: '',
    apiKey: undefined,
    defaultModel: undefined,
    source: 'default',
  }
}
