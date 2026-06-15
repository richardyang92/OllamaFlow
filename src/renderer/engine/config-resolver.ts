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

/**
 * 解析节点要使用的模型名（模型名集中解析的单一入口）。
 *
 * 优先级：节点自身配置的 model > 全局默认模型。
 * 此前各 executor 直接使用 data.model，节点未设模型时会向 API 发送空串导致报错；
 * 此函数统一兜底到全局默认模型，使"一处配置（全局默认模型），处处生效"在执行链落地。
 *
 * @param nodeModel 节点自身配置的模型名（可能为空串 / undefined）
 * @returns 最终使用的模型名；若全局默认也缺省则返回 undefined
 */
export function resolveModel(nodeModel?: string): string | undefined {
  if (nodeModel && nodeModel.trim()) {
    return nodeModel
  }
  return getGlobalDefaultModel()
}
