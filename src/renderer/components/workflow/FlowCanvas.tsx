import { useCallback, useRef, DragEvent, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
  ReactFlowInstance,
  Node,
  Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useWorkflowStore } from '@/store/workflow-store'
import { WorkflowNodeData, WorkflowNode } from '@/types/node'

// Import node components
import ManualTriggerNode from '@/components/nodes/ManualTriggerNode'
import InputNode from '@/components/nodes/InputNode'
import OllamaChatNode from '@/components/nodes/OllamaChatNode'
import SetNode from '@/components/nodes/SetNode'
import IfNode from '@/components/nodes/IfNode'
import OutputNode from '@/components/nodes/OutputNode'
import ReadFileNode from '@/components/nodes/ReadFileNode'
import WriteFileNode from '@/components/nodes/WriteFileNode'
import ExecuteCommandNode from '@/components/nodes/ExecuteCommandNode'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  manualTrigger: ManualTriggerNode,
  input: InputNode,
  ollamaChat: OllamaChatNode,
  set: SetNode,
  if: IfNode,
  output: OutputNode,
  readFile: ReadFileNode,
  writeFile: WriteFileNode,
  executeCommand: ExecuteCommandNode,
}

export default function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<Node<WorkflowNodeData>, Edge> | null>(null)

  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectNode } =
    useWorkflowStore()

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const data = event.dataTransfer.getData('application/reactflow')
      if (!data) return

      const template = JSON.parse(data)
      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect()

      if (reactFlowInstance && reactFlowBounds) {
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        })

        const newNode: WorkflowNode = {
          id: `${template.type}-${Date.now()}`,
          type: template.type,
          position,
          data: {
            ...template.defaultData,
            label: template.label,
          } as WorkflowNodeData,
        }

        addNode(newNode)
      }
    },
    [reactFlowInstance, addNode]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<WorkflowNodeData>) => {
      selectNode(node.id)
    },
    [selectNode]
  )

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  return (
    <div ref={reactFlowWrapper} className="flex-1 bg-gray-800">
      <ReactFlow<Node<WorkflowNodeData>, Edge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={15} size={1} color="#374151" />
        <Controls className="bg-gray-700 border-0 [&>button]:bg-gray-600 [&>button]:border-0 [&>button]:text-white [&>button:hover]:bg-gray-500" />
        <MiniMap
          className="bg-gray-700 border-0"
          nodeColor={(node) => {
            switch (node.data?.status) {
              case 'running':
                return '#fbbf24'
              case 'success':
                return '#22c55e'
              case 'error':
                return '#ef4444'
              default:
                return '#4b5563'
            }
          }}
        />
      </ReactFlow>
    </div>
  )
}
