/**
 * 全局 AI 配置类型定义
 * 用于配置全局 OpenAI 兼容 API 端点，覆盖所有工作区和节点配置
 */

/**
 * 全局 AI 配置
 */
export interface GlobalAIConfig {
  /** 是否启用全局配置 */
  enabled: boolean
  /** API 端点 (OpenAI 兼容格式) */
  apiEndpoint: string
  /** 默认模型 */
  defaultModel?: string
  /** 提供商类型 */
  provider: AIProvider
  /** 配置名称（用于 UI 显示） */
  name?: string
}

/**
 * 支持的 AI 提供商类型
 */
export type AIProvider = 'ollama' | 'openai' | 'deepseek' | 'vllm' | 'custom'

/**
 * 模型信息
 */
export interface ModelInfo {
  /** 模型 ID */
  id: string
  /** 模型显示名称 */
  name?: string
  /** 模型所有者 */
  owned_by?: string
}

/**
 * 解析后的 AI 配置
 */
export interface ResolvedAIConfig {
  /** API 端点 */
  apiEndpoint: string
  /** API Key */
  apiKey: string | undefined
  /** 默认模型 */
  defaultModel: string | undefined
  /** 配置来源 */
  source: 'global' | 'workspace' | 'node' | 'default'
}

/**
 * 提供商预设配置
 *
 * 数据实现统一从 @/config/model-config 集中管理（一处修改，处处生效）；
 * 此处仅作重导出，保持历史 import 路径（@/types/global-config）不破坏。
 */
export { AI_PROVIDER_PRESETS } from '@/config/model-config'
