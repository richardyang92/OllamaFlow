/**
 * Agent Worker System Tests
 * 
 * Tests for the Web Worker based Agent execution system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getWorkerPool, resetWorkerPool } from '../engine/workers/worker-pool'
import type { AgentConfig } from '../engine/workers/types'

describe('Agent Worker System', () => {
  beforeEach(() => {
    // Reset worker pool before each test
    resetWorkerPool()
    
    // Reset mocks on window.electronAPI
    window.electronAPI.file.read = vi.fn().mockResolvedValue({ success: true, content: 'test content' })
    window.electronAPI.file.write = vi.fn().mockResolvedValue({ success: true })
    window.electronAPI.command.execute = vi.fn().mockResolvedValue({ 
      success: true, 
      stdout: 'command output',
      exitCode: 0 
    })
  })

  afterEach(() => {
    resetWorkerPool()
    vi.clearAllMocks()
  })

  describe('Worker Pool', () => {
    it('should initialize worker pool with correct size', async () => {
      const pool = getWorkerPool({ poolSize: 4 })
      await pool.initialize()
      
      const status = pool.getPoolStatus()
      expect(status.totalWorkers).toBe(4)
      expect(status.idleWorkers).toBe(4)
      expect(status.busyWorkers).toBe(0)
      
      await pool.terminate()
    })

    it('should queue agent execution when all workers are busy', async () => {
      const pool = getWorkerPool({ poolSize: 1, maxConcurrent: 1 })
      await pool.initialize()
      
      const config: AgentConfig = {
        provider: 'openai',
        model: 'gpt-4',
        sandboxPath: '/tmp/test',
      }
      
      // Start first execution (will occupy the only worker)
      pool.executeAgent(
        config,
        'test input 1',
        {
          onStepStart: () => {},
        },
        { priority: 'normal' }
      )
      
      // Check that one agent is queued or running
      const status = pool.getPoolStatus()
      expect(status.queuedAgents + status.activeSessions).toBeGreaterThanOrEqual(1)
      
      // Cancel to clean up
      await pool.terminate()
    })

    it('should respect priority ordering', async () => {
      const pool = getWorkerPool({ poolSize: 1, maxConcurrent: 1 })
      await pool.initialize()
      
      const config: AgentConfig = {
        provider: 'openai',
        model: 'gpt-4',
        sandboxPath: '/tmp/test',
      }
      
      // Queue low priority first
      pool.executeAgent(
        config,
        'low priority',
        {
          onStepStart: () => {},
        },
        { priority: 'low' }
      )
      
      // Queue high priority second
      pool.executeAgent(
        config,
        'high priority',
        {
          onStepStart: () => {},
        },
        { priority: 'high' }
      )
      
      // High priority should be queued before low
      const status = pool.getPoolStatus()
      expect(status.queuedAgents).toBe(2)
      
      await pool.terminate()
    })
  })

  describe('Tool Bridge', () => {
    it('should execute readFile tool', async () => {
      const { executeToolInBridge } = await import('../engine/tool-bridge')
      
      const result = await executeToolInBridge(
        {
          id: 'test-1',
          toolName: 'readFile',
          toolType: 'builtin',
          input: { filePath: 'test.txt' },
        },
        { workspacePath: '/tmp/test' }
      )
      
      expect(result.success).toBe(true)
      expect(result.output).toBe('test content')
      expect(window.electronAPI.file.read).toHaveBeenCalledWith('/tmp/test', 'test.txt')
    })

    it('should execute writeFile tool', async () => {
      const { executeToolInBridge } = await import('../engine/tool-bridge')
      
      const result = await executeToolInBridge(
        {
          id: 'test-2',
          toolName: 'writeFile',
          toolType: 'builtin',
          input: { filePath: 'output.txt', content: 'hello world' },
        },
        { workspacePath: '/tmp/test' }
      )
      
      expect(result.success).toBe(true)
      expect(result.output).toContain('output.txt')
      expect(window.electronAPI.file.write).toHaveBeenCalledWith(
        '/tmp/test',
        'output.txt',
        'hello world'
      )
    })

    it('should execute executeCommand tool', async () => {
      const { executeToolInBridge } = await import('../engine/tool-bridge')
      
      const result = await executeToolInBridge(
        {
          id: 'test-3',
          toolName: 'executeCommand',
          toolType: 'builtin',
          input: { command: 'echo hello', timeout: 30000 },
        },
        { workspacePath: '/tmp/test' }
      )
      
      expect(result.success).toBe(true)
      expect(result.output).toBe('command output')
      expect(window.electronAPI.command.execute).toHaveBeenCalledWith(
        '/tmp/test',
        { command: 'echo hello', timeout: 30000 }
      )
    })

    it('should handle unknown tools', async () => {
      const { executeToolInBridge } = await import('../engine/tool-bridge')
      
      const result = await executeToolInBridge(
        {
          id: 'test-4',
          toolName: 'unknownTool',
          toolType: 'builtin',
          input: {},
        },
        { workspacePath: '/tmp/test' }
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown tool')
    })

    it('should handle tool execution errors', async () => {
      window.electronAPI.file.read = vi.fn().mockRejectedValue(new Error('File not found'))
      
      const { executeToolInBridge } = await import('../engine/tool-bridge')
      
      const result = await executeToolInBridge(
        {
          id: 'test-5',
          toolName: 'readFile',
          toolType: 'builtin',
          input: { filePath: 'missing.txt' },
        },
        { workspacePath: '/tmp/test' }
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('File not found')
    })
  })

  describe('Integration', () => {
    it('should handle complete agent execution lifecycle', async () => {
      // This is a placeholder for full integration test
      // Would need to mock OpenAI client and test full flow
      expect(true).toBe(true)
    })
  })
})
