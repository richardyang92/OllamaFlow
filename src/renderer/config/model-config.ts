/**
 * 模型配置唯一来源（Single Source of Truth）
 *
 * 所有与 AI 模型相关的"配置默认值"集中在此文件：
 *   1. DEFAULT_ENDPOINTS    —— Base URL / 端点兜底值
 *   2. AI_PROVIDER_PRESETS  —— 提供商预设表（端点 + 显示名）
 *   3. DEFAULT_NODE_PARAMS  —— 各 AI 节点的生成参数默认值（用户可在属性面板覆盖）
 *   4. INTERNAL_LLM_PARAMS  —— 内部固定调用参数（非用户可配，命名以消除魔法数字）
 *   5. MODEL_CONTEXT_LIMITS —— 每模型上下文窗口限制
 *
 * 设计原则：
 *   - 一处修改，处处生效 —— 散落在各 executor / store / 组件中的硬编码值统一改从此处引入。
 *   - 保留节点级覆盖 —— 节点字段（model / temperature / maxTokens 等）继续保留，
 *     已保存的 .ollamaflow 工作流无需迁移，新建节点才使用此处的默认值。
 */

import type { AIProvider } from '@/types/global-config'

/* -------------------------------------------------------------------------- */
/* 1. Base URL / 端点兜底值                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 各提供商的默认端点。
 * 替代此前散落于 openai-client / executor / execution-manager / agent-executor /
 * Welcome / AgentQuestionsManager / PlanQuestionsManager 等十余处的硬编码字符串。
 */
export const DEFAULT_ENDPOINTS = {
  /** Ollama 原生地址（无 /v1 后缀，用于状态检测等） */
  ollama: 'http://127.0.0.1:11434',
  /** Ollama OpenAI 兼容端点（带 /v1） */
  ollamaApi: 'http://127.0.0.1:11434/v1',
  /** OpenAI 官方端点 */
  openai: 'https://api.openai.com/v1',
  /** DeepSeek 官方端点 */
  deepseek: 'https://api.deepseek.com/v1',
  /** vLLM 本地端点 */
  vllm: 'http://localhost:8000/v1',
} as const

/* -------------------------------------------------------------------------- */
/* 2. 提供商预设                                                               */
/* -------------------------------------------------------------------------- */

/**
 * 提供商预设配置（端点 + 显示名）。
 * 数据归此文件管理；类型定义仍在 @/types/global-config.ts。
 * 此前定义于 global-config.ts，迁入此处以集中管理。
 */
export const AI_PROVIDER_PRESETS: Record<AIProvider, { endpoint: string; name: string }> = {
  ollama: { endpoint: DEFAULT_ENDPOINTS.ollamaApi, name: 'Ollama (本地)' },
  openai: { endpoint: DEFAULT_ENDPOINTS.openai, name: 'OpenAI' },
  deepseek: { endpoint: DEFAULT_ENDPOINTS.deepseek, name: 'DeepSeek' },
  vllm: { endpoint: DEFAULT_ENDPOINTS.vllm, name: 'vLLM' },
  custom: { endpoint: '', name: '自定义' },
}

/* -------------------------------------------------------------------------- */
/* 3. 节点级生成参数默认值（用户可在属性面板覆盖）                                */
/* -------------------------------------------------------------------------- */

/**
 * 各 AI 节点新建时的默认生成参数。
 * 替代此前散落于 types/node.ts / wizard/templates.ts 的不一致默认值
 * （曾出现 0.7/0.3/0.1、8192/4096/4000/50 等混乱数值）。
 */
export const DEFAULT_NODE_PARAMS = {
  /** Ollama 对话节点 */
  ollamaChat: {
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 8192,
    stream: true,
  },
  /** ReAct 智能体节点 */
  reactAgent: {
    temperature: 0.7,
    maxTokens: 4096,
    stream: true,
    maxIterations: 10,
  },
  /** 智能规划节点 */
  plan: {
    temperature: 0.7,
    maxTokens: 4096,
  },
  /** 智能路由节点 */
  smartRouter: {
    temperature: 0.3,
  },
} as const

/* -------------------------------------------------------------------------- */
/* 4. 内部固定调用参数（非用户可配）                                             */
/* -------------------------------------------------------------------------- */

/**
 * 引擎内部固定调用参数，以语义化命名替代魔法数字。
 */
export const INTERNAL_LLM_PARAMS = {
  /** 智能路由分类调用：仅需极短输出判定分支 */
  routing: {
    maxTokens: 50,
  },
  /** ReAct 智能体上下文摘要调用 */
  summarization: {
    temperature: 0.3,
    maxTokens: 4000,
  },
  /** agent-executor 数据转换调用 */
  transform: {
    temperature: 0.1,
    maxTokens: 4096,
  },
} as const

/* -------------------------------------------------------------------------- */
/* 5. 每模型上下文窗口限制                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 上下文压缩配置。
 * 此前定义于 engine/react-agent/context-compressor.ts，迁入此处以集中管理。
 */
export interface ContextConfig {
  maxContextTokens: number
  reserveTokens: number
  keepRecentIterations: number
  maxObservationLength: number
  enableSummarization: boolean
  preserveErrors?: boolean
  preserveMilestones?: boolean
  maxErrorLength?: number
  // LLM compression options
  enableLLMCompression?: boolean
}

/**
 * 各已知模型的上下文窗口限制。
 */
export const MODEL_CONTEXT_LIMITS: Record<string, ContextConfig> = {
  'gpt-4': {
    maxContextTokens: 8000,
    reserveTokens: 1000,
    keepRecentIterations: 3,
    maxObservationLength: 1500,
    enableSummarization: true,
    preserveErrors: true,
  },
  'gpt-4-turbo': {
    maxContextTokens: 120000,
    reserveTokens: 4000,
    keepRecentIterations: 5,
    maxObservationLength: 2000,
    enableSummarization: true,
    preserveErrors: true,
  },
  'gpt-4o': {
    maxContextTokens: 120000,
    reserveTokens: 4000,
    keepRecentIterations: 5,
    maxObservationLength: 2000,
    enableSummarization: true,
    preserveErrors: true,
  },
  'gpt-3.5-turbo': {
    maxContextTokens: 4000,
    reserveTokens: 500,
    keepRecentIterations: 2,
    maxObservationLength: 1000,
    enableSummarization: true,
    preserveErrors: true,
  },
  'deepseek-chat': {
    maxContextTokens: 60000,
    reserveTokens: 4000,
    keepRecentIterations: 5,
    maxObservationLength: 2000,
    enableSummarization: true,
    preserveErrors: true,
  },
  'deepseek-reasoner': {
    maxContextTokens: 60000,
    reserveTokens: 4000,
    keepRecentIterations: 4,
    maxObservationLength: 1500,
    enableSummarization: true,
    preserveErrors: true,
  },
  'default': {
    maxContextTokens: 100000,
    reserveTokens: 4000,
    keepRecentIterations: 4,
    maxObservationLength: 1500,
    enableSummarization: true,
    preserveErrors: true,
  },
}

/**
 * 根据模型名解析上下文配置。
 * 先精确匹配，再按模型名前缀做模糊匹配，最终回退到 'default'。
 */
export function getContextConfig(model: string): ContextConfig {
  const normalizedModel = model.toLowerCase()

  if (MODEL_CONTEXT_LIMITS[normalizedModel]) {
    return MODEL_CONTEXT_LIMITS[normalizedModel]
  }

  for (const [key, config] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (normalizedModel.includes(key) || key.includes(normalizedModel.split('-')[0])) {
      return config
    }
  }

  return MODEL_CONTEXT_LIMITS.default
}
