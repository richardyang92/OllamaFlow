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
 */
export const AI_PROVIDER_PRESETS: Record<AIProvider, { endpoint: string; name: string }> = {
  ollama: { endpoint: 'http://127.0.0.1:11434/v1', name: 'Ollama (本地)' },
  openai: { endpoint: 'https://api.openai.com/v1', name: 'OpenAI' },
  deepseek: { endpoint: 'https://api.deepseek.com/v1', name: 'DeepSeek' },
  vllm: { endpoint: 'http://localhost:8000/v1', name: 'vLLM' },
  custom: { endpoint: '', name: '自定义' },
}
