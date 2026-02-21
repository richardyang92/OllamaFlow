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
  OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'

import { useWorkflowStore } from '@/store/workflow-store'
import { WorkflowNodeData, WorkflowNode } from '@/types/node'

// Import node components
import InputNode from '@/components/nodes/InputNode'
import OllamaChatNode from '@/components/nodes/OllamaChatNode'
import SetNode from '@/components/nodes/SetNode'
import IfNode from '@/components/nodes/IfNode'
import LoopNode from '@/components/nodes/LoopNode'
import OutputNode from '@/components/nodes/OutputNode'
import ReadFileNode from '@/components/nodes/ReadFileNode'
import WriteFileNode from '@/components/nodes/WriteFileNode'
import ExecuteCommandNode from '@/components/nodes/ExecuteCommandNode'
import ImageNode from '@/components/nodes/ImageNode'
import ReactAgentNode from '@/components/nodes/ReactAgentNode'

// Import edge components
import AnimatedEdge from '@/components/workflow/edges/AnimatedEdge'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  input: InputNode,
  ollamaChat: OllamaChatNode,
  set: SetNode,
  if: IfNode,
  loop: LoopNode,
  output: OutputNode,
  image: ImageNode,
  readFile: ReadFileNode,
  writeFile: WriteFileNode,
  executeCommand: ExecuteCommandNode,
  reactAgent: ReactAgentNode,
}

// Edge types
const edgeTypes = {
  animated: AnimatedEdge,
}

// Empty Canvas Guidance Component
function EmptyCanvasState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div className="max-w-md text-center p-8 rounded-2xl bg-card-bg backdrop-blur-md border border-white/10 shadow-2xl">
        <div className="text-6xl mb-4">🎯</div>
        <h2 className="text-2xl font-bold text-white mb-3">开始构建工作流</h2>
        <p className="text-gray-400 mb-6">
          从左侧面板拖拽节点到画布，连接它们创建自动化流程
        </p>
        <div className="grid grid-cols-2 gap-4 text-left">
          <div className="p-3 rounded-lg bg-white/5">
            <div className="text-2xl mb-2">📥</div>
            <div className="text-sm font-semibold text-white mb-1">添加输入</div>
            <div className="text-xs text-gray-500">开始工作流的数据</div>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <div className="text-2xl mb-2">🤖</div>
            <div className="text-sm font-semibold text-white mb-1">AI 处理</div>
            <div className="text-xs text-gray-500">使用 Ollama 模型</div>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <div className="text-2xl mb-2">🔀</div>
            <div className="text-sm font-semibold text-white mb-1">条件逻辑</div>
            <div className="text-xs text-gray-500">分支和控制流</div>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <div className="text-2xl mb-2">📤</div>
            <div className="text-sm font-semibold text-white mb-1">输出结果</div>
            <div className="text-xs text-gray-500">显示或保存数据</div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">1</span>
              拖拽节点
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">2</span>
              连接端口
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">3</span>
              配置属性
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">4</span>
              执行工作流
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
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

        let parentId: string | undefined = undefined

        const targetNode = document.elementFromPoint(event.clientX, event.clientY)
        if (targetNode) {
          const loopNodeElement = targetNode.closest('[data-node-id^="loop-"]')
          if (loopNodeElement) {
            const nodeId = loopNodeElement.getAttribute('data-node-id')
            if (nodeId) {
              const loopNode = nodes.find(n => n.id === nodeId)
              if (loopNode && loopNode.data.nodeType === 'loop') {
                parentId = nodeId
              }
            }
          }
        }

        let finalPosition = position
        if (parentId) {
          finalPosition = {
            x: 20,
            y: 160,
          }
        }

        const newNode: WorkflowNode = {
          id: `${template.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: template.type,
          position: finalPosition,
          parentId: parentId,
          extent: parentId ? 'parent' : undefined,
          expandParent: parentId ? true : undefined,
          width: template.type === 'loop' ? 600 : undefined,
          height: template.type === 'loop' ? 400 : undefined,
          data: {
            ...template.defaultData,
            label: template.label,
          } as WorkflowNodeData,
        }

        addNode(newNode)
      }
    },
    [reactFlowInstance, addNode, nodes]
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

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    // Edge selection is handled by React Flow automatically
    console.log('Edge clicked:', edge.id)
  }, [])

  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      // Log selection for debugging
      if (params.edges.length > 0) {
        console.log('Edges selected:', params.edges.map(e => e.id))
      }
    },
    []
  )

  return (
    <div ref={reactFlowWrapper} className="flex-1 bg-[#0d0d0d] m-4 rounded-xl border border-white/10 shadow-2xl overflow-hidden relative">
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
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode={['Delete', 'Backspace']}
        defaultEdgeOptions={{
          type: 'default',
          animated: false,
          style: { stroke: 'rgba(255, 255, 255, 0.15)', strokeWidth: 2 },
          selectable: true,
          deletable: true,
        }}
        className="overview-visible"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255, 255, 255, 0.04)" />
        <Controls className="!bg-white/5 !backdrop-blur-md !border-white/8 !rounded-lg overflow-hidden [&>button]:bg-transparent [&>button]:border-b [&>button]:border-white/5 [&>button]:text-zinc-400 [&>button:hover]:bg-white/10 [&>button:hover]:text-white [&>button]:transition-all [&>button]:duration-200" />
        <MiniMap
          className="!bg-white/5 !backdrop-blur-md !border-white/8 !rounded-lg"
          nodeColor={(node) => {
            switch (node.data?.status) {
              case 'running':
                return '#eab308'
              case 'success':
                return '#22c55e'
              case 'error':
                return '#ef4444'
              default:
                return '#3f3f46'
            }
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
        />
      </ReactFlow>
      {nodes.length === 0 && <EmptyCanvasState />}
    </div>
  )
}
