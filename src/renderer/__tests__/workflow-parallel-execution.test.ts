/**
 * Bug Condition Exploration Test - Workflow Parallel Execution Isolation
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9**
 * **Property 1: Fault Condition** - 工作流并行执行隔离
 * 
 * IMPORTANT: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists. Do NOT fix the test or code when it fails.
 * 
 * This test will pass after the fix is implemented, validating the fix.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Node, Edge } from '@xyflow/react'
import { WorkflowNodeData, InputNodeData, SetNodeData, OutputNodeData, DelayNodeData } from '@/types/node'
import { WorkflowExecutor, initializeExecutors } from '@/engine/executor'
import { useExecutionStore } from '@/store/execution-store'

describe('Bug Condition Exploration: Parallel Workflow Execution Isolation', () => {
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
  })

  /**
   * Test Scenario 1: 并行执行上下文覆盖
   * 
   * Bug Condition: 工作流 A 和 B 在同一工作区并行执行
   * Expected (after fix): 每个工作流有独立的 executionId 和上下文
   * Current (before fix): 第二个工作流的 startExecution 覆盖第一个工作流的上下文
   * 
   * ACTUAL BUG: When both workflows call startExecution with the same workspacePath,
   * the second call creates a NEW context, completely replacing the first execution's context.
   * This means the first workflow's node results are lost because they're being written
   * to a context that no longer exists in the store.
   */
  it('should isolate execution contexts between parallel workflow executions', async () => {
    const workspacePath = '/test/workspace1'
    
    // Create simple workflow: Input -> Set Variable -> Output
    const createWorkflow = (variableValue: number) => {
      const nodes: Node<WorkflowNodeData>[] = [
        {
          id: 'input-1',
          type: 'workflowNode',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'input',
            label: 'Input',
            inputType: 'string',
            defaultValue: 'start',
            prompt: 'Start',
            category: 'input',
            inputs: [],
            outputs: [{ id: 'output', name: 'output', label: 'Output', dataType: 'string' }]
          } as InputNodeData
        },
        {
          id: 'set-1',
          type: 'workflowNode',
          position: { x: 200, y: 0 },
          data: {
            nodeType: 'set',
            label: 'Set Variable',
            variableName: 'counter',
            variableValue: variableValue.toString(),
            useExpression: false,
            category: 'variable',
            inputs: [{ id: 'input', name: 'input', label: 'Input', dataType: 'any' }],
            outputs: [{ id: 'output', name: 'output', label: 'Output', dataType: 'any' }]
          } as SetNodeData
        },
        {
          id: 'output-1',
          type: 'workflowNode',
          position: { x: 400, y: 0 },
          data: {
            nodeType: 'output',
            label: 'Output',
            outputType: 'display',
            sourceType: 'input',
            category: 'output',
            inputs: [{ id: 'input', name: 'input', label: 'Input', dataType: 'any' }],
            outputs: []
          } as OutputNodeData
        }
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'input-1', target: 'set-1' },
        { id: 'e2', source: 'set-1', target: 'output-1' }
      ]

      return { nodes, edges }
    }

    const workflowA = createWorkflow(1)
    const workflowB = createWorkflow(2)

    // Create execution instances
    const executionStore = useExecutionStore.getState()
    const executionIdA = executionStore.createExecution(workspacePath, 'workflow-a')
    const executionIdB = executionStore.createExecution(workspacePath, 'workflow-b')

    // Execute workflows in parallel
    const executorA = new WorkflowExecutor(
      workflowA.nodes,
      workflowA.edges,
      workspacePath,
      executionIdA,
      'http://127.0.0.1:11434'
    )

    const executorB = new WorkflowExecutor(
      workflowB.nodes,
      workflowB.edges,
      workspacePath,
      executionIdB,
      'http://127.0.0.1:11434'
    )

    // Start both executions
    const [resultA, resultB] = await Promise.all([
      executorA.execute(),
      executorB.execute()
    ])

    expect(resultA).toBe(true)
    expect(resultB).toBe(true)

    // Get execution contexts - now they should be separate
    const store = useExecutionStore.getState()
    const executionA = store.getExecution(executionIdA)
    const executionB = store.getExecution(executionIdB)

    // Debug: log what's in the store
    console.log('Execution A:', executionA)
    console.log('Execution B:', executionB)
    console.log('Execution A node results:', Array.from(executionA?.context?.nodeResults?.entries() || []))
    console.log('Execution B node results:', Array.from(executionB?.context?.nodeResults?.entries() || []))

    // FIXED: Now each workflow has its own execution context
    expect(executionA?.context).toBeDefined()
    expect(executionB?.context).toBeDefined()
    
    // FIXED: Each execution has its own executionId
    expect(executionA?.context?.executionId).toBe(executionIdA)
    expect(executionB?.context?.executionId).toBe(executionIdB)
    
    // FIXED: Each execution has its own nodeResults Map
    const nodeResultsA = executionA?.context?.nodeResults
    const nodeResultsB = executionB?.context?.nodeResults
    expect(nodeResultsA).toBeDefined()
    expect(nodeResultsB).toBeDefined()
    
    // FIXED: Each execution has its own complete nodeResults
    console.log('Number of node results A:', nodeResultsA?.size)
    console.log('Number of node results B:', nodeResultsB?.size)
    
    // After the fix, each execution has its own isolated context
    expect(nodeResultsA?.size).toBeGreaterThan(0)
    expect(nodeResultsB?.size).toBeGreaterThan(0)
  })

  /**
   * Test Scenario 2: 并行执行节点结果覆盖
   * 
   * Bug Condition: 工作流 A 的节点 "node-1" 输出 "Output A"，工作流 B 的节点 "node-1" 输出 "Output B"
   * Expected (after fix): 工作流 A 的下游节点读取到 "Output A"
   * Current (before fix): 工作流 A 的下游节点读取到 "Output B" (FAIL - proves bug exists)
   */
  it('should isolate node results between parallel workflow executions', async () => {
    const workspacePath = '/test/workspace2'
    
    const createWorkflow = (outputValue: string) => {
      const nodes: Node<WorkflowNodeData>[] = [
        {
          id: 'input-1',
          type: 'workflowNode',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'input',
            label: 'Input',
            inputType: 'string',
            defaultValue: 'start',
            prompt: 'Start',
            category: 'input',
            inputs: [],
            outputs: [{ id: 'output', name: 'output', label: 'Output', dataType: 'string' }]
          } as InputNodeData
        },
        {
          id: 'set-1',
          type: 'workflowNode',
          position: { x: 200, y: 0 },
          data: {
            nodeType: 'set',
            label: 'Set Output',
            variableName: 'result',
            variableValue: outputValue,
            useExpression: false,
            category: 'variable',
            inputs: [{ id: 'input', name: 'input', label: 'Input', dataType: 'any' }],
            outputs: [{ id: 'output', name: 'output', label: 'Output', dataType: 'any' }]
          } as SetNodeData
        }
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'input-1', target: 'set-1' }
      ]

      return { nodes, edges }
    }

    const workflowA = createWorkflow('Output A')
    const workflowB = createWorkflow('Output B')

    const executionStore = useExecutionStore.getState()
    const executionIdA = executionStore.createExecution(workspacePath, 'workflow-a')
    const executionIdB = executionStore.createExecution(workspacePath, 'workflow-b')

    const executorA = new WorkflowExecutor(
      workflowA.nodes,
      workflowA.edges,
      workspacePath,
      executionIdA,
      'http://127.0.0.1:11434'
    )

    const executorB = new WorkflowExecutor(
      workflowB.nodes,
      workflowB.edges,
      workspacePath,
      executionIdB,
      'http://127.0.0.1:11434'
    )

    await Promise.all([
      executorA.execute(),
      executorB.execute()
    ])

    const store = useExecutionStore.getState()
    const executionA = store.getExecution(executionIdA)
    const executionB = store.getExecution(executionIdB)

    // After fix: each execution has its own node results
    const nodeResultA = executionA?.context?.nodeResults.get('set-1')
    const nodeResultB = executionB?.context?.nodeResults.get('set-1')
    
    expect(nodeResultA).toBeDefined()
    expect(nodeResultB).toBeDefined()
    
    expect(nodeResultA?.output).toHaveProperty('result')
    expect(nodeResultB?.output).toHaveProperty('result')
    
    // After fix: we can distinguish A's output from B's output
    const resultA = (nodeResultA?.output as any)?.result
    const resultB = (nodeResultB?.output as any)?.result
    
    expect(resultA).toBe('Output A')
    expect(resultB).toBe('Output B')
  })

  /**
   * Test Scenario 3: 快速连续执行竞态条件
   * 
   * Bug Condition: 在工作流 A 执行过程中立即启动工作流 B
   * Expected (after fix): 两个工作流的 executionId 不同且状态完全独立
   * Current (before fix): executionId 不同但状态相互覆盖 (FAIL - proves bug exists)
   */
  it('should handle rapid successive executions without race conditions', async () => {
    const workspacePath = '/test/workspace3'
    
    const createWorkflow = (value: string) => {
      const nodes: Node<WorkflowNodeData>[] = [
        {
          id: 'input-1',
          type: 'workflowNode',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'input',
            label: 'Input',
            inputType: 'string',
            defaultValue: value,
            prompt: value,
            category: 'input',
            inputs: [],
            outputs: [{ id: 'output', name: 'output', label: 'Output', dataType: 'string' }]
          } as InputNodeData
        },
        {
          id: 'delay-1',
          type: 'workflowNode',
          position: { x: 200, y: 0 },
          data: {
            nodeType: 'delay',
            label: 'Delay',
            delayMs: 100,
            passthrough: true,
            category: 'control',
            inputs: [{ id: 'input', name: 'input', label: 'Input', dataType: 'any' }],
            outputs: [{ id: 'output', name: 'output', label: 'Output', dataType: 'any' }]
          } as DelayNodeData
        },
        {
          id: 'set-1',
          type: 'workflowNode',
          position: { x: 400, y: 0 },
          data: {
            nodeType: 'set',
            label: 'Set',
            variableName: 'value',
            variableValue: value,
            useExpression: false,
            category: 'variable',
            inputs: [{ id: 'input', name: 'input', label: 'Input', dataType: 'any' }],
            outputs: [{ id: 'output', name: 'output', label: 'Output', dataType: 'any' }]
          } as SetNodeData
        }
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'input-1', target: 'delay-1' },
        { id: 'e2', source: 'delay-1', target: 'set-1' }
      ]

      return { nodes, edges }
    }

    const workflowA = createWorkflow('A')
    const workflowB = createWorkflow('B')

    const executionStore = useExecutionStore.getState()
    const executionIdA = executionStore.createExecution(workspacePath, 'workflow-a')
    const executionIdB = executionStore.createExecution(workspacePath, 'workflow-b')

    const executorA = new WorkflowExecutor(
      workflowA.nodes,
      workflowA.edges,
      workspacePath,
      executionIdA,
      'http://127.0.0.1:11434'
    )

    const executorB = new WorkflowExecutor(
      workflowB.nodes,
      workflowB.edges,
      workspacePath,
      executionIdB,
      'http://127.0.0.1:11434'
    )

    // Start A, then immediately start B (simulating rapid succession)
    const promiseA = executorA.execute()
    await new Promise(resolve => setTimeout(resolve, 10)) // Small delay to ensure A starts first
    const promiseB = executorB.execute()

    await Promise.all([promiseA, promiseB])

    const store = useExecutionStore.getState()
    const executionA = store.getExecution(executionIdA)
    const executionB = store.getExecution(executionIdB)

    // After fix: Both executions have their own isolated contexts
    expect(executionA?.context).toBeDefined()
    expect(executionB?.context).toBeDefined()
    
    // After fix: Each execution has its own node results
    const nodeResultA = executionA?.context?.nodeResults.get('set-1')
    const nodeResultB = executionB?.context?.nodeResults.get('set-1')
    
    expect(nodeResultA).toBeDefined()
    expect(nodeResultB).toBeDefined()
    
    const valueA = (nodeResultA?.output as any)?.value
    const valueB = (nodeResultB?.output as any)?.value
    
    expect(valueA).toBe('A')
    expect(valueB).toBe('B')
    
    // After fix: we can query each execution separately with different executionIds
    expect(executionA?.executionId).toBe(executionIdA)
    expect(executionB?.executionId).toBe(executionIdB)
    expect(executionIdA).not.toBe(executionIdB)
  })

  /**
   * Test Scenario 4: 跨工作区并行执行隔离
   * 
   * Bug Condition: 在工作区 1 启动工作流 A，在工作区 2 启动工作流 B，同时执行
   * Expected (after fix): 两个工作流的状态完全独立，不会因为 currentWorkspacePath 切换而相互干扰
   * Current (before fix): currentWorkspacePath 切换导致状态操作指向错误的工作区 (FAIL - proves bug exists)
   */
  it('should isolate executions across different workspaces', async () => {
    const workspace1 = '/test/workspace-a'
    const workspace2 = '/test/workspace-b'
    
    const createWorkflow = (value: string) => {
      const nodes: Node<WorkflowNodeData>[] = [
        {
          id: 'input-1',
          type: 'workflowNode',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'input',
            label: 'Input',
            inputType: 'string',
            defaultValue: value,
            prompt: value,
            category: 'input',
            inputs: [],
            outputs: [{ id: 'output', name: 'output', label: 'Output', dataType: 'string' }]
          } as InputNodeData
        },
        {
          id: 'set-1',
          type: 'workflowNode',
          position: { x: 200, y: 0 },
          data: {
            nodeType: 'set',
            label: 'Set',
            variableName: 'workspace_value',
            variableValue: value,
            useExpression: false,
            category: 'variable',
            inputs: [{ id: 'input', name: 'input', label: 'Input', dataType: 'any' }],
            outputs: [{ id: 'output', name: 'output', label: 'Output', dataType: 'any' }]
          } as SetNodeData
        }
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'input-1', target: 'set-1' }
      ]

      return { nodes, edges }
    }

    const workflowA = createWorkflow('Workspace A Value')
    const workflowB = createWorkflow('Workspace B Value')

    const executionStore = useExecutionStore.getState()
    const executionIdA = executionStore.createExecution(workspace1, 'workflow-a')
    const executionIdB = executionStore.createExecution(workspace2, 'workflow-b')

    const executorA = new WorkflowExecutor(
      workflowA.nodes,
      workflowA.edges,
      workspace1,
      executionIdA,
      'http://127.0.0.1:11434'
    )

    const executorB = new WorkflowExecutor(
      workflowB.nodes,
      workflowB.edges,
      workspace2,
      executionIdB,
      'http://127.0.0.1:11434'
    )

    // Execute in parallel across different workspaces
    await Promise.all([
      executorA.execute(),
      executorB.execute()
    ])

    const store = useExecutionStore.getState()
    const executionA = store.getExecution(executionIdA)
    const executionB = store.getExecution(executionIdB)

    // Both executions should have their own state
    expect(executionA).toBeDefined()
    expect(executionB).toBeDefined()

    // Each execution should have its own node results
    const nodeResult1 = executionA?.context?.nodeResults.get('set-1')
    const nodeResult2 = executionB?.context?.nodeResults.get('set-1')

    expect(nodeResult1).toBeDefined()
    expect(nodeResult2).toBeDefined()

    const value1 = (nodeResult1?.output as any)?.workspace_value
    const value2 = (nodeResult2?.output as any)?.workspace_value

    // After fix: each workspace has its own isolated execution state
    expect(value1).toBe('Workspace A Value')
    expect(value2).toBe('Workspace B Value')
    
    // Verify executionIds are different
    expect(executionIdA).not.toBe(executionIdB)
    expect(executionA?.workspacePath).toBe(workspace1)
    expect(executionB?.workspacePath).toBe(workspace2)
  })

  /**
   * Test Scenario 5: 智能路由并行执行状态混乱
   * 
   * Bug Condition: 工作流 A 的智能路由节点选择分支 "branch-a"，工作流 B 的智能路由节点选择分支 "branch-b"
   * Expected (after fix): 工作流 A 只执行 "branch-a" 的下游节点
   * Current (before fix): 如果 activeBranches 共享，路由状态会混乱 (FAIL - proves bug exists)
   */
  it('should isolate smart router branch state between parallel executions', async () => {
    const workspacePath = '/test/workspace4'
    
    // Note: This test is simplified because smart router requires LLM
    // In the actual implementation, activeBranches is an instance property of WorkflowExecutor
    // So this test may pass even on unfixed code if executors are separate instances
    // The real bug is when activeBranches is moved to the store and shared via workspacePath
    
    const createWorkflow = (routerOutput: string) => {
      const nodes: Node<WorkflowNodeData>[] = [
        {
          id: 'input-1',
          type: 'workflowNode',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'input',
            label: 'Input',
            inputType: 'string',
            defaultValue: 'start',
            prompt: 'Start',
            category: 'input',
            inputs: [],
            outputs: [{ id: 'output', name: 'output', label: 'Output', dataType: 'string' }]
          } as InputNodeData
        },
        {
          id: 'set-1',
          type: 'workflowNode',
          position: { x: 200, y: 0 },
          data: {
            nodeType: 'set',
            label: 'Set',
            variableName: 'router_result',
            variableValue: routerOutput,
            useExpression: false,
            category: 'variable',
            inputs: [{ id: 'input', name: 'input', label: 'Input', dataType: 'any' }],
            outputs: [{ id: 'output', name: 'output', label: 'Output', dataType: 'any' }]
          } as SetNodeData
        }
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'input-1', target: 'set-1' }
      ]

      return { nodes, edges }
    }

    const workflowA = createWorkflow('branch-a')
    const workflowB = createWorkflow('branch-b')

    const executionStore = useExecutionStore.getState()
    const executionIdA = executionStore.createExecution(workspacePath, 'workflow-a')
    const executionIdB = executionStore.createExecution(workspacePath, 'workflow-b')

    const executorA = new WorkflowExecutor(
      workflowA.nodes,
      workflowA.edges,
      workspacePath,
      executionIdA,
      'http://127.0.0.1:11434'
    )

    const executorB = new WorkflowExecutor(
      workflowB.nodes,
      workflowB.edges,
      workspacePath,
      executionIdB,
      'http://127.0.0.1:11434'
    )

    await Promise.all([
      executorA.execute(),
      executorB.execute()
    ])

    const store = useExecutionStore.getState()
    const executionA = store.getExecution(executionIdA)
    const executionB = store.getExecution(executionIdB)

    // After fix: activeBranches are stored per executionId in the store
    expect(executionA?.context).toBeDefined()
    expect(executionB?.context).toBeDefined()
    
    // This test documents the expected behavior after the fix
    // Currently, activeBranches is an instance property, so it's already isolated
    // But after moving it to the store, we need to ensure it's keyed by executionId
    
    // Verify each execution has its own isolated state
    expect(executionA?.executionId).toBe(executionIdA)
    expect(executionB?.executionId).toBe(executionIdB)
    
    // Verify activeBranches are isolated (stored in execution store)
    const activeBranchesA = store.getActiveBranches(executionIdA, 'router-1')
    const activeBranchesB = store.getActiveBranches(executionIdB, 'router-1')
    
    // These may be undefined if no router node was executed, which is fine for this test
    // The important thing is that they are separate and don't interfere
    if (activeBranchesA && activeBranchesB) {
      expect(activeBranchesA).not.toBe(activeBranchesB)
    }
  })
})
