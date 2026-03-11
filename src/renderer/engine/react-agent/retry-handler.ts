/**
 * Retry Handler for Agent Execution
 * Provides exponential backoff retry mechanism for API calls and tool execution
 */

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: number[]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [408, 429, 500, 502, 503, 504],
}

export class RetryableError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'RetryableError'
  }

  get isRetryable(): boolean {
    return DEFAULT_RETRY_CONFIG.retryableErrors.includes(this.statusCode)
  }
}

export class MaxRetriesExceededError extends Error {
  constructor(
    public attempts: number,
    public lastError: Error
  ) {
    super(`Max retries (${attempts}) exceeded. Last error: ${lastError.message}`)
    this.name = 'MaxRetriesExceededError'
  }
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)
  return Math.min(delay, config.maxDelay)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (error instanceof RetryableError) {
    return config.retryableErrors.includes(error.statusCode)
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('socket hang up') ||
      message.includes('fetch failed')
    ) {
      return true
    }
  }
  
  return false
}

export interface RetryResult<T> {
  result: T
  attempts: number
  totalDelay: number
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
  onRetry?: (attempt: number, error: Error, delay: number) => void
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error | null = null
  let attempts = 0
  let totalDelay = 0

  while (attempts < finalConfig.maxRetries) {
    attempts++
    
    try {
      const result = await fn()
      return { result, attempts, totalDelay }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (!isRetryableError(error, finalConfig)) {
        throw error
      }
      
      if (attempts >= finalConfig.maxRetries) {
        throw new MaxRetriesExceededError(attempts, lastError)
      }
      
      const delay = calculateDelay(attempts, finalConfig)
      totalDelay += delay
      
      onRetry?.(attempts, lastError, delay)
      
      await sleep(delay)
    }
  }
  
  throw new MaxRetriesExceededError(attempts, lastError || new Error('Unknown error'))
}

export interface ToolExecutionResult {
  success: boolean
  result: string
  error?: string
}

export async function executeToolWithRetry(
  toolExecutor: () => Promise<ToolExecutionResult>,
  toolName: string,
  config?: Partial<RetryConfig> & { 
    validateBeforeRetry?: (result: ToolExecutionResult) => boolean 
  },
  onRetry?: (attempt: number, error: Error | null, delay: number) => void
): Promise<ToolExecutionResult> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, maxRetries: 2, ...config }
  let attempts = 0
  let totalDelay = 0

  while (attempts < finalConfig.maxRetries) {
    attempts++
    
    try {
      const result = await toolExecutor()
      
      if (result.success) {
        return result
      }
      
      if (config?.validateBeforeRetry && !config.validateBeforeRetry(result)) {
        return result
      }
      
      if (attempts >= finalConfig.maxRetries) {
        return result
      }
      
      const delay = calculateDelay(attempts, finalConfig)
      totalDelay += delay
      
      onRetry?.(attempts, null, delay)
      
      await sleep(delay)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      
      if (attempts >= finalConfig.maxRetries) {
        return {
          success: false,
          result: '',
          error: `工具 ${toolName} 执行失败 (重试 ${attempts} 次后): ${err.message}`
        }
      }
      
      const delay = calculateDelay(attempts, finalConfig)
      totalDelay += delay
      
      onRetry?.(attempts, err, delay)
      
      await sleep(delay)
    }
  }
  
  return {
    success: false,
    result: '',
    error: `工具 ${toolName} 执行失败`
  }
}

export function createRetryLogger(
  logger: (message: string) => void
): (attempt: number, error: Error | null, delay: number) => void {
  return (attempt: number, error: Error | null, delay: number) => {
    if (error) {
      logger(`[重试 ${attempt}] 错误: ${error.message}，${delay}ms 后重试...`)
    } else {
      logger(`[重试 ${attempt}] 执行未成功，${delay}ms 后重试...`)
    }
  }
}
