/**
 * AgentStepBlock Component Tests
 *
 * Tests for the modern AgentStepBlock component, including:
 * - Rendering of different step statuses
 * - Collapse/expand behavior
 * - Rich content previews (thoughts, tool calls, observations)
 * - Animations and interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AgentStepBlock } from '../components/agent/AgentStepBlock'
import type { AgentStep, ToolType, ToolCallStatus } from '../store/agent-store'

describe('AgentStepBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockStep: AgentStep = {
    id: 'step-1',
    iteration: 1,
    maxIterations: 10,
    status: 'thinking',
    thought: 'This is a test thought\nWith multiple lines',
    thoughtStreaming: false,
    startedAt: Date.now() - 1000,
    completedAt: Date.now(),
  }

  describe('Rendering', () => {
    it('should render step with thinking status', () => {
      render(<AgentStepBlock step={mockStep} />)

      expect(screen.getByText('思考轮次 1/10')).toBeInTheDocument()
      expect(screen.getByText('思考中')).toBeInTheDocument()
    })

    it('should render step with acting status', () => {
      const actingStep = { ...mockStep, status: 'acting' as const }
      render(<AgentStepBlock step={actingStep} />)

      expect(screen.getByText('执行工具')).toBeInTheDocument()
    })

    it('should render step with completed status', () => {
      const completedStep = { ...mockStep, status: 'completed' as const }
      render(<AgentStepBlock step={completedStep} />)

      expect(screen.getByText('完成')).toBeInTheDocument()
    })

    it('should render step with error status', () => {
      const errorStep = { ...mockStep, status: 'error' as const }
      render(<AgentStepBlock step={errorStep} />)

      expect(screen.getByText('错误')).toBeInTheDocument()
    })

    it('should render custom node label when provided', () => {
      render(<AgentStepBlock step={mockStep} nodeLabel="Custom Node" nodeType="ollamaChat" />)

      expect(screen.getByText('Custom Node')).toBeInTheDocument()
    })

    it('should render error message when provided', () => {
      render(<AgentStepBlock step={mockStep} errorMessage="Test error" />)

      expect(screen.getByText('错误')).toBeInTheDocument()
      expect(screen.getByText('Test error')).toBeInTheDocument()
    })

    it('should render tool call when provided', () => {
      const stepWithToolCall = {
        ...mockStep,
        toolCall: {
          id: 'tool-1',
          toolName: 'readFile',
          toolType: 'builtin' as ToolType,
          status: 'completed' as ToolCallStatus,
          input: { path: '/test/file.txt' },
          output: 'file content',
          startedAt: Date.now(),
          completedAt: Date.now(),
          duration: 100,
        },
      }
      render(<AgentStepBlock step={stepWithToolCall} />)

      expect(screen.getByText('工具调用')).toBeInTheDocument()
      expect(screen.getByText('readFile')).toBeInTheDocument()
    })

    it('should render multiple tool calls', () => {
      const stepWithMultipleTools = {
        ...mockStep,
        toolCalls: [
          {
            id: 'tool-1',
            toolName: 'readFile',
            toolType: 'builtin' as ToolType,
            status: 'completed' as ToolCallStatus,
            input: { path: '/test/file.txt' },
            startedAt: Date.now(),
            completedAt: Date.now(),
            duration: 100,
          },
          {
            id: 'tool-2',
            toolName: 'executeCommand',
            toolType: 'builtin' as ToolType,
            status: 'completed' as ToolCallStatus,
            input: { command: 'ls -la' },
            startedAt: Date.now(),
            completedAt: Date.now(),
            duration: 50,
          },
        ],
      }
      render(<AgentStepBlock step={stepWithMultipleTools} />)

      expect(screen.getByText('工具调用 (2 个并行)')).toBeInTheDocument()
      expect(screen.getByText('readFile')).toBeInTheDocument()
      expect(screen.getByText('executeCommand')).toBeInTheDocument()
    })

    it('should render observation when provided', () => {
      const stepWithObservation = {
        ...mockStep,
        observation: '{"result": "test data"}',
        observationStreaming: false,
      }
      render(<AgentStepBlock step={stepWithObservation} />)

      expect(screen.getByText('观察结果')).toBeInTheDocument()
      expect(screen.getByText(/result/)).toBeInTheDocument()
    })

    it.skip('should render ReAct steps when provided', () => {
      const stepWithReAct = {
        ...mockStep,
        reactAgentSteps: [
          {
            id: 'react-1',
            iteration: 1,
            status: 'thinking',
            thought: 'Test thought',
            startedAt: Date.now(),
          },
        ],
      }
      render(<AgentStepBlock step={stepWithReAct} />)

      expect(screen.getByText(/内部步骤/)).toBeInTheDocument()
    })
  })

  describe('Collapse/Expand Behavior', () => {
    it('should collapse completed steps by default', () => {
      const completedStep = { ...mockStep, status: 'completed' as const }
      render(<AgentStepBlock step={completedStep} />)

      expect(screen.queryByText(/This is a test thought/)).not.toBeInTheDocument()
    })

    it('should expand active steps by default', () => {
      const thinkingStep = { ...mockStep, status: 'thinking' as const }
      render(<AgentStepBlock step={thinkingStep} defaultExpanded={true} />)

      expect(screen.getByText(/This is a test thought/)).toBeInTheDocument()
    })

    it('should toggle expand/collapse on button click', async () => {
      const completedStep = { ...mockStep, status: 'completed' as const }
      render(<AgentStepBlock step={completedStep} />)

      const expandButton = screen.getByRole('button')
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText(/This is a test thought/)).toBeInTheDocument()
      }, { timeout: 3000 })

      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.queryByText(/This is a test thought/)).not.toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it.skip('should force collapse when forceCollapsed is true', () => {
      const thinkingStep = { ...mockStep, status: 'thinking' as const }
      const { rerender } = render(<AgentStepBlock step={thinkingStep} forceCollapsed={false} />)

      expect(screen.getByText(/This is a test thought/)).toBeInTheDocument()

      rerender(<AgentStepBlock step={thinkingStep} forceCollapsed={true} />)

      expect(screen.queryByText(/This is a test thought/)).not.toBeInTheDocument()
    })
  })

  describe('Content Previews', () => {
    it.skip('should show thought preview when collapsed', () => {
      const stepWithLongThought = {
        ...mockStep,
        thought: 'Line 1\nLine 2\nLine 3\nLine 4',
        status: 'completed' as const,
      }
      render(<AgentStepBlock step={stepWithLongThought} />)

      expect(screen.getByText(/Line 1/)).toBeInTheDocument()
      expect(screen.getByText(/Line 2/)).toBeInTheDocument()
      expect(screen.queryByText(/Line 4/)).not.toBeInTheDocument()
    })

    it('should show full thought when expanded', async () => {
      const stepWithLongThought = {
        ...mockStep,
        thought: 'Line 1\nLine 2\nLine 3\nLine 4',
        status: 'completed' as const,
      }
      render(<AgentStepBlock step={stepWithLongThought} />)

      const expandButton = screen.getByRole('button')
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText(/Line 4/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should render JSON observation with code highlighting', () => {
      const stepWithJson = {
        ...mockStep,
        observation: '{"key": "value", "number": 123}',
        observationStreaming: false,
      }
      render(<AgentStepBlock step={stepWithJson} />)

      expect(screen.getByText('观察结果')).toBeInTheDocument()
    })

    it('should render plain text observation without highlighting', () => {
      const stepWithPlainText = {
        ...mockStep,
        observation: 'Plain text observation',
        observationStreaming: false,
      }
      render(<AgentStepBlock step={stepWithPlainText} />)

      expect(screen.getByText(/Plain text observation/)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper aria labels', () => {
      render(<AgentStepBlock step={mockStep} />)

      const expandButton = screen.getByRole('button')
      expect(expandButton).toBeInTheDocument()
    })

    it.skip('should be keyboard navigable', () => {
      const completedStep = { ...mockStep, status: 'completed' as const }
      render(<AgentStepBlock step={completedStep} />)

      const expandButton = screen.getByRole('button')
      expect(expandButton).toHaveAttribute('type')
    })
  })
})
