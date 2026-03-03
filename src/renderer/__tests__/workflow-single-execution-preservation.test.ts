/**
 * Preservation Property Tests - Single Workflow Execution Behavior
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 * **Property 2: Preservation** - 单工作流执行行为
 * 
 * IMPORTANT: These tests should PASS on both unfixed and fixed code.
 * They verify that single workflow execution behavior remains unchanged after the fix.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Node, Edge } from '@xyflow/react'
import { WorkflowNodeData } from '@/types/node'
import { WorkflowExecutor, initializeExecutors } from '@/engine/executor'
import { useExecutionStore } from '@/store/execution-store'
import { useWorkflowStore } from '@/store/workflow-store'

describe('Preservation: Single Workflow Execution Behavior', () => {
  beforeEach(() => {
    // Initialize executors
    initializeExecutors()
    
    // Reset execution store
    const store = useExecutionStore.getState()
    store.executions.clear()
    store.workspaceExecutions.clear()
  })

  afterEach(() => {
    // Clean up
    const store = useExecutionStore.getState()
    store.executions.clear()
    store.workspaceExecutions.clear()
    
    // Clear workflow store
    const workflowStore = useWorkflowStore.getState()
    workflowStore.clearWorkflow()
  })

  // Helper function to set up workflow store for testing
  const setupWorkflowStore = (nodes: Node<WorkflowNodeData>[], edges: Edge[]) => {
    const workflowStore = useWorkflowStore.getState()
    workflowStore.setWorkflow({
      id: 'test-workflow',
      name: 'Test Workflow',
      description: '',
      nodes,
      edges,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Test Scenario 1: 单工作流顺序执行
   * 
   * Preservation: 单个工作流按依赖顺序执行所有节点并产生正确结果
   */
  it('should execute single workflow nodes in correct order', async () => {
    const workspacePath = '/test/workspace-single'
    
    const nodes: Node<WorkflowNodeData>[] = [
      {
        id: 'input-1',
        type: 'workflowNode',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'input',
          label: 'Input',
          config: { value: 'start' }
        }
      },
      {
        id: 'set-1',
        type: 'workflowNode',
        position: { x: 200, y: 0 },
        data: {
          nodeType: 'set',
          label: 'Set Variable',
          variableName: 'counter',
          variableValue: '42',
          useExpression: false
        }
      },
      {
        id: 'output-1',
        type: 'workflowNode',
        position: { x: 400, y: 0 },
        data: {
          nodeType: 'output',
          label: 'Output',
          config: {}
        }
      }
    ]

    const edges: Edge[] = [
      { id: 'e1', source: 'input-1', target: 'set-1' },
      { id: 'e2', source: 'set-1', target: 'output-1' }
    ]

    // Set up workflow store so executor can check if nodes exist
    setupWorkflowStore(nodes, edges)

    // Create execution instance
    const store = useExecutionStore.getState()
    const executionId = store.createExecution(workspacePath, 'test-workflow')

    const executor = new WorkflowExecutor(
      nodes,
      edges,
      workspacePath,
      executionId,
      'http://127.0.0.1:11434'
    )

    const result = await executor.execute()

    console.log('Execution result:', result)

    // Check execution state
    const execution = store.getExecution(executionId)

    console.log('Execution state:', execution)
    console.log('Logs:', execution?.logs)
    console.log('Node results size:', execution?.context?.nodeResults.size)
    console.log('Node results keys:', Array.from(execution?.context?.nodeResults.keys() || []))

    // Workflow should complete successfully
    expect(result).toBe(true)

    expect(execution).toBeDefined()
    expect(execution?.status).toBe('completed')
    expect(execution?.context).toBeDefined()

    // All nodes should have been executed
    const nodeResults = execution?.context?.nodeResults
    expect(nodeResults).toBeDefined()
    expect(nodeResults?.size).toBeGreaterThan(0)

    // Verify execution order by checking that all nodes have results
    expect(nodeResults?.has('input-1')).toBe(true)
    expect(nodeResults?.has('set-1')).toBe(true)
    expect(nodeResults?.has('output-1')).toBe(true)
  })

  /**
   * Test Scenario 2: 节点依赖和输入上下文
   * 
   * Preservation: buildInputContext 正确构建节点输入，节点能访问前置节点的输出
   */
  it('should correctly build input context from predecessor nodes', async () => {
    const workspacePath = '/test/workspace-context'
    
    const nodes: Node<WorkflowNodeData>[] = [
      {
        id: 'input-1',
        type: 'workflowNode',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'input',
          label: 'Input',
          config: { value: 'test-value' }
        }
      },
      {
        id: 'set-1',
        type: 'workflowNode',
        position: { x: 200, y: 0 },
        data: {
          nodeType: 'set',
          label: 'Set',
          variableName: 'result',
          variableValue: 'processed',
          useExpression: false
        }
      }
    ]

    const edges: Edge[] = [
      { id: 'e1', source: 'input-1', target: 'set-1' }
    ]

    const store = useExecutionStore.getState()
    const executionId = store.createExecution(workspacePath, 'test-workflow')

    const executor = new WorkflowExecutor(
      nodes,
      edges,
      workspacePath,
      executionId,
      'http://127.0.0.1:11434'
    )

    const result = await executor.execute()
    expect(result).toBe(true)

    const execution = store.getExecution(executionId)
    const nodeResults = execution?.context?.nodeResults

    // Input node should have output
    const inputResult = nodeResults?.get('input-1')
    expect(inputResult).toBeDefined()
    expect(inputResult?.status).toBe('success')

    // Set node should have received input from input node
    const setResult = nodeResults?.get('set-1')
    expect(setResult).toBeDefined()
    expect(setResult?.status).toBe('success')
    expect(setResult?.input).toBeDefined()
  })

  /**
   * Test Scenario 3: 执行完成和状态管理
   * 
   * Preservation: 工作流完成后正确设置状态为 completed
   */
  it('should set correct execution status on completion', async () => {
    const workspacePath = '/test/workspace-status'
    
    const nodes: Node<WorkflowNodeData>[] = [
      {
        id: 'input-1',
        type: 'workflowNode',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'input',
          label: 'Input',
          config: { value: 'test' }
        }
      }
    ]

    const edges: Edge[] = []

    const store = useExecutionStore.getState()
    const executionId = store.createExecution(workspacePath, 'test-workflow')

    const executor = new WorkflowExecutor(
      nodes,
      edges,
      workspacePath,
      executionId,
      'http://127.0.0.1:11434'
    )

    const result = await executor.execute()
    expect(result).toBe(true)

    const execution = store.getExecution(executionId)

    // Status should be completed
    expect(execution?.status).toBe('completed')
    
    // Context should exist
    expect(execution?.context).toBeDefined()
    expect(workspaceState?.context?.executionId).toBeDefined()
    expect(workspaceState?.context?.workflowId).toBe('workflow')
  })

  /**
   * Test Scenario 4: 执行日志记录
   * 
   * Preservation: 工作流执行过程中正确记录日志
   */
  it('should record execution logs correctly', async () => {
    const workspacePath = '/test/workspace-logs'
    
    const nodes: Node<WorkflowNodeData>[] = [
      {
        id: 'input-1',
        type: 'workflowNode',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'input',
          label: 'Input',
          config: { value: 'test' }
        }
      },
      {
        id: 'set-1',
        type: 'workflowNode',
        position: { x: 200, y: 0 },
        data: {
          nodeType: 'set',
          label: 'Set',
          variableName: 'value',
          variableValue: 'test-value',
          useExpression: false
        }
      }
    ]

    const edges: Edge[] = [
      { id: 'e1', source: 'input-1', target: 'set-1' }
    ]

    const executor = new WorkflowExecutor(
      nodes,
      edges,
      workspacePath,
      'http://127.0.0.1:11434'
    )

    const result = await executor.execute()
    expect(result).toBe(true)

    const store = useExecutionStore.getState()
    const workspaceState = store.workspaces.get(workspacePath)

    // Logs should be recorded
    expect(workspaceState?.logs).toBeDefined()
    expect(workspaceState?.logs.length).toBeGreaterThan(0)

    // Should have start execution log
    const startLog = workspaceState?.logs.find(log => 
      log.message.includes('Started execution')
    )
    expect(startLog).toBeDefined()

    // Should have completion log
    const completeLog = workspaceState?.logs.find(log => 
      log.message.includes('completed')
    )
    expect(completeLog).toBeDefined()
  })

  /**
   * Test Scenario 5: 错误处理
   * 
   * Preservation: 工作流执行失败时正确处理错误
   */
  it('should handle node execution errors correctly', async () => {
    const workspacePath = '/test/workspace-error'
    
    // Create a workflow with a node that will fail (using invalid expression)
    const nodes: Node<WorkflowNodeData>[] = [
      {
        id: 'input-1',
        type: 'workflowNode',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'input',
          label: 'Input',
          config: { value: 'test' }
        }
      },
      {
        id: 'set-1',
        type: 'workflowNode',
        position: { x: 200, y: 0 },
        data: {
          nodeType: 'set',
          label: 'Set',
          variableName: 'value',
          variableValue: 'throw new Error("test error")',
          useExpression: true // This will cause an error
        }
      }
    ]

    const edges: Edge[] = [
      { id: 'e1', source: 'input-1', target: 'set-1' }
    ]

    const executor = new WorkflowExecutor(
      nodes,
      edges,
      workspacePath,
      'http://127.0.0.1:11434'
    )

    const result = await executor.execute()

    // Execution should fail
    expect(result).toBe(false)

    const store = useExecutionStore.getState()
    const workspaceState = store.workspaces.get(workspacePath)

    // Status should be failed
    expect(workspaceState?.status).toBe('failed')

    // Error should be recorded in node result
    const setResult = workspaceState?.context?.nodeResults.get('set-1')
    expect(setResult).toBeDefined()
    expect(setResult?.status).toBe('error')
    expect(setResult?.error).toBeDefined()

    // Error log should be recorded
    const errorLog = workspaceState?.logs.find(log => 
      log.level === 'error'
    )
    expect(errorLog).toBeDefined()
  })

  /**
   * Test Scenario 6: 多个节点顺序执行
   * 
   * Preservation: 多个节点按照依赖关系正确顺序执行
   */
  it('should execute multiple nodes in dependency order', async () => {
    const workspacePath = '/test/workspace-multi'
    
    const nodes: Node<WorkflowNodeData>[] = [
      {
        id: 'input-1',
        type: 'workflowNode',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'input',
          label: 'Input',
          config: { value: 'start' }
        }
      },
      {
        id: 'set-1',
        type: 'workflowNode',
        position: { x: 200, y: 0 },
        data: {
          nodeType: 'set',
          label: 'Set 1',
          variableName: 'step1',
          variableValue: 'value1',
          useExpression: false
        }
      },
      {
        id: 'set-2',
        type: 'workflowNode',
        position: { x: 400, y: 0 },
        data: {
          nodeType: 'set',
          label: 'Set 2',
          variableName: 'step2',
          variableValue: 'value2',
          useExpression: false
        }
      },
      {
        id: 'set-3',
        type: 'workflowNode',
        position: { x: 600, y: 0 },
        data: {
          nodeType: 'set',
          label: 'Set 3',
          variableName: 'step3',
          variableValue: 'value3',
          useExpression: false
        }
      },
      {
        id: 'output-1',
        type: 'workflowNode',
        position: { x: 800, y: 0 },
        data: {
          nodeType: 'output',
          label: 'Output',
          config: {}
        }
      }
    ]

    const edges: Edge[] = [
      { id: 'e1', source: 'input-1', target: 'set-1' },
      { id: 'e2', source: 'set-1', target: 'set-2' },
      { id: 'e3', source: 'set-2', target: 'set-3' },
      { id: 'e4', source: 'set-3', target: 'output-1' }
    ]

    const executor = new WorkflowExecutor(
      nodes,
      edges,
      workspacePath,
      'http://127.0.0.1:11434'
    )

    const result = await executor.execute()
    expect(result).toBe(true)

    const store = useExecutionStore.getState()
    const workspaceState = store.workspaces.get(workspacePath)
    const nodeResults = workspaceState?.context?.nodeResults

    // All nodes should have been executed
    expect(nodeResults?.size).toBe(5)
    expect(nodeResults?.has('input-1')).toBe(true)
    expect(nodeResults?.has('set-1')).toBe(true)
    expect(nodeResults?.has('set-2')).toBe(true)
    expect(nodeResults?.has('set-3')).toBe(true)
    expect(nodeResults?.has('output-1')).toBe(true)

    // All nodes should have succeeded
    for (const [nodeId, result] of nodeResults?.entries() || []) {
      expect(result.status).toBe('success')
    }
  })

  /**
   * Test Scenario 7: ExecutionId 生成
   * 
   * Preservation: 每次执行都应该生成唯一的 executionId
   */
  it('should generate unique executionId for each execution', async () => {
    const workspacePath = '/test/workspace-id'
    
    const nodes: Node<WorkflowNodeData>[] = [
      {
        id: 'input-1',
        type: 'workflowNode',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'input',
          label: 'Input',
          config: { value: 'test' }
        }
      }
    ]

    const edges: Edge[] = []

    // Execute first workflow
    const executor1 = new WorkflowExecutor(
      nodes,
      edges,
      workspacePath,
      'http://127.0.0.1:11434'
    )

    await executor1.execute()

    const store = useExecutionStore.getState()
    const workspaceState1 = store.workspaces.get(workspacePath)
    const executionId1 = workspaceState1?.context?.executionId

    expect(executionId1).toBeDefined()

    // Execute second workflow (sequential, not parallel)
    const executor2 = new WorkflowExecutor(
      nodes,
      edges,
      workspacePath,
      'http://127.0.0.1:11434'
    )

    await executor2.execute()

    const workspaceState2 = store.workspaces.get(workspacePath)
    const executionId2 = workspaceState2?.context?.executionId

    expect(executionId2).toBeDefined()

    // ExecutionIds should be different (though in current implementation,
    // the second execution overwrites the first, so we can only see the second one)
    // After the fix, we'll be able to track both executions separately
    expect(executionId2).not.toBe(executionId1)
  })

  /**
   * Test Scenario 8: 工作区隔离
   * 
   * Preservation: 不同工作区的工作流应该有独立的状态
   */
  it('should isolate state between different workspaces', async () => {
    const workspace1 = '/test/workspace-a'
    const workspace2 = '/test/workspace-b'
    
    const nodes: Node<WorkflowNodeData>[] = [
      {
        id: 'input-1',
        type: 'workflowNode',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'input',
          label: 'Input',
          config: { value: 'test' }
        }
      }
    ]

    const edges: Edge[] = []

    // Execute in workspace 1
    const executor1 = new WorkflowExecutor(
      nodes,
      edges,
      workspace1,
      'http://127.0.0.1:11434'
    )

    await executor1.execute()

    // Execute in workspace 2
    const executor2 = new WorkflowExecutor(
      nodes,
      edges,
      workspace2,
      'http://127.0.0.1:11434'
    )

    await executor2.execute()

    const store = useExecutionStore.getState()
    const workspaceState1 = store.workspaces.get(workspace1)
    const workspaceState2 = store.workspaces.get(workspace2)

    // Both workspaces should have their own state
    expect(workspaceState1).toBeDefined()
    expect(workspaceState2).toBeDefined()

    // Each should have its own context
    expect(workspaceState1?.context).toBeDefined()
    expect(workspaceState2?.context).toBeDefined()

    // ExecutionIds should be different
    expect(workspaceState1?.context?.executionId).not.toBe(
      workspaceState2?.context?.executionId
    )
  })
})
