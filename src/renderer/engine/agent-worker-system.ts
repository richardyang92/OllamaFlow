/**
 * Agent Worker System - 统一导出
 * 
 * Web Worker based Agent execution system for OllamaFlow
 */

// ============ 核心类型 ============
export type {
  AgentConfig,
  AgentStep,
  ToolCallInfo,
  ToolResult,
  AgentCallbacks,
  WorkerToMainMessage,
  MainToWorkerMessage,
} from './workers/types'

// ============ Worker 池 ============
export { 
  WorkerPoolManager, 
  getWorkerPool, 
  resetWorkerPool,
  type WorkerPoolOptions 
} from './workers/worker-pool'

// ============ 控制器 ============
export { AgentController, type ExecuteOptions } from './agent-controller'

// ============ 工具桥接 ============
export { executeToolInBridge } from './tool-bridge'

// ============ React Hooks ============
export { useAgent, type UseAgentOptions, type UseAgentReturn } from '../hooks/useAgent'
export { 
  useAgentWorkerAdapter, 
  type AgentExecutorConfig, 
  type AgentExecutorCallbacks 
} from '../hooks/useAgentWorkerAdapter'

// ============ React Agent Worker ============
export {
  executeReactAgentInWorker,
  shouldUseWorkerMode,
  setWorkerMode,
  type ReactAgentWorkerOptions,
} from './nodes/react-agent-worker'

// ============ 版本信息 ============
export const AGENT_WORKER_VERSION = '1.0.0'
