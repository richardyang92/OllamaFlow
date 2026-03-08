/**
 * AI 配置解析器
 * 统一使用全局配置
 */

import type { ResolvedAIConfig } from '@/types/global-config'
import { useSettingsStore } from '@/store/settings-store'

/**
 * 解析 AI 配置
 * 现在只使用全局配置
 *
 * @returns 解析后的配置
 */
export async function resolveAIConfig(): Promise<ResolvedAIConfig> {
  const settingsStore = useSettingsStore.getState()

  // 只使用全局配置
  if (settingsStore.isGlobalAIEnabled && settingsStore.globalAIConfig) {
    const globalApiKey = await window.electronAPI.globalAI.getApiKey()
    return {
      apiEndpoint: settingsStore.globalAIConfig.apiEndpoint,
      apiKey: globalApiKey || undefined,
      defaultModel: settingsStore.globalAIConfig.defaultModel,
      source: 'global',
    }
  }

  // 如果全局配置未启用，返回空配置
  throw new Error('全局 AI 配置未启用。请在设置中配置全局 AI。')
}

/**
 * 同步检查是否启用了全局配置
 */
export function isGlobalAIEnabled(): boolean {
  return useSettingsStore.getState().isGlobalAIEnabled
}

/**
 * 获取全局配置的模型列表
 */
export function getGlobalModels() {
  return useSettingsStore.getState().availableModels
}

/**
 * 获取全局默认模型
 */
export function getGlobalDefaultModel(): string | undefined {
  const { globalAIConfig, isGlobalAIEnabled } = useSettingsStore.getState()
  if (isGlobalAIEnabled && globalAIConfig) {
    return globalAIConfig.defaultModel
  }
  return undefined
}
