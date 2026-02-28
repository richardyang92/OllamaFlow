import { useCallback, useRef, DragEvent, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  ConnectionMode,
  ReactFlowInstance,
  Node,
  Edge,
  OnSelectionChangeParams,
  type ColorMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'
import { Target, ArrowDownToLine, Bot, GitBranch, ArrowUpFromLine } from 'lucide-react'

import { useWorkflowStore } from '@/store/workflow-store'
import { WorkflowNodeData, WorkflowNode } from '@/types/node'

import InputNode from '@/components/nodes/InputNode'
import OllamaChatNode from '@/components/nodes/OllamaChatNode'
import SetNode from '@/components/nodes/SetNode'
import IfNode from '@/components/nodes/IfNode'
import LoopNode from '@/components/nodes/LoopNode'
import SmartRouterNode from '@/components/nodes/SmartRouterNode'
import OutputNode from '@/components/nodes/OutputNode'
import ReadFileNode from '@/components/nodes/ReadFileNode'
import WriteFileNode from '@/components/nodes/WriteFileNode'
import ExecuteCommandNode from '@/components/nodes/ExecuteCommandNode'
import ImageNode from '@/components/nodes/ImageNode'
import ReactAgentNode from '@/components/nodes/ReactAgentNode'
import QueueNode from '@/components/nodes/QueueNode'
import SplitterNode from '@/components/nodes/SplitterNode'

import AnimatedEdge from '@/components/workflow/edges/AnimatedEdge'
import { MiniMap } from '@/components/workflow/MiniMap'

const nodeTypes: Record<string, unknown> = {
  input: InputNode,
  ollamaChat: OllamaChatNode,
  set: SetNode,
  if: IfNode,
  loop: LoopNode,
  smartRouter: SmartRouterNode,
  output: OutputNode,
  image: ImageNode,
  readFile: ReadFileNode,
  writeFile: WriteFileNode,
  executeCommand: ExecuteCommandNode,
  reactAgent: ReactAgentNode,
  queue: QueueNode,
  splitter: SplitterNode,
}

const edgeTypes = {
  default: AnimatedEdge,
  animated: AnimatedEdge,
}

interface FlowCanvasProps {
  colorMode?: ColorMode
  onDragStart?: () => void
  onNodeClick?: () => void
}

function EmptyCanvasState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div className="max-w-md text-center p-8 rounded-2xl glass-panel">
        <Target className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)]" />
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">开始构建工作流</h2>
        <p className="text-[var(--color-text-muted)] mb-6">
          从左侧面板拖拽节点到画布，连接它们创建自动化流程
        </p>
        <div className="grid grid-cols-2 gap-4 text-left">
          <div className="p-3 rounded-lg bg-[var(--color-bg-input)]">
            <ArrowDownToLine className="w-5 h-5 mb-2 text-cyan-400" />
            <div className="text-sm font-semibold text-[var(--color-text)] mb-1">添加输入</div>
            <div className="text-xs text-[var(--color-text-muted)]">开始工作流的数据</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-bg-input)]">
            <Bot className="w-5 h-5 mb-2 text-purple-400" />
            <div className="text-sm font-semibold text-[var(--color-text)] mb-1">AI 处理</div>
            <div className="text-xs text-[var(--color-text-muted)]">使用 Ollama 模型</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-bg-input)]">
            <GitBranch className="w-5 h-5 mb-2 text-blue-400" />
            <div className="text-sm font-semibold text-[var(--color-text)] mb-1">条件逻辑</div>
            <div className="text-xs text-[var(--color-text-muted)]">分支和控制流</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-bg-input)]">
            <ArrowUpFromLine className="w-5 h-5 mb-2 text-teal-400" />
            <div className="text-sm font-semibold text-[var(--color-text)] mb-1">输出结果</div>
            <div className="text-xs text-[var(--color-text-muted)]">显示或保存数据</div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-[var(--color-border-subtle)]">
          <div className="flex items-center justify-center gap-6 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-[var(--color-bg-input)] flex items-center justify-center">1</span>
              拖拽节点
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-[var(--color-bg-input)] flex items-center justify-center">2</span>
              连接端口
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-[var(--color-bg-input)] flex items-center justify-center">3</span>
              配置属性
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-[var(--color-bg-input)] flex items-center justify-center">4</span>
              执行工作流
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function FlowCanvas({ colorMode = 'system', onDragStart, onNodeClick: onNodeClickProp }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<Node<WorkflowNodeData>, Edge> | null>(null)

  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectNode } =
    useWorkflowStore()

  const onInit = useCallback((instance: ReactFlowInstance<Node<WorkflowNodeData>, Edge>) => {
    setReactFlowInstance(instance)
  }, [])

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    onDragStart?.()
  }, [onDragStart])

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
      onNodeClickProp?.()
    },
    [selectNode, onNodeClickProp]
  )

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  const onEdgeClick = useCallback((_event: React.MouseEvent, _edge: Edge) => {
    // 边点击处理（可用于未来扩展）
  }, [])

  const onSelectionChange = useCallback(
    (_params: OnSelectionChangeParams) => {
      // 选择变化处理（可用于未来扩展）
    },
    []
  )

  return (
    <div 
      ref={reactFlowWrapper} 
      className="flex-1 overflow-hidden relative"
    >
      <ReactFlow<Node<WorkflowNodeData>, Edge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        colorMode={colorMode}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode={['Delete', 'Backspace']}
        defaultEdgeOptions={{
          type: 'default',
          animated: false,
          style: { stroke: 'var(--color-border)', strokeWidth: 2 },
          selectable: true,
          deletable: true,
        }}
        className="overview-visible"
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={1} 
          color="var(--color-border-subtle)" 
        />
        <Controls 
          className="!bg-[var(--glass-bg)] !backdrop-blur-md !border-[var(--glass-border)] !rounded-lg overflow-hidden [&>button]:bg-transparent [&>button]:border-b [&>button]:border-[var(--color-border-subtle)] [&>button]:text-[var(--color-text-muted)] [&>button:hover]:bg-[var(--color-bg-input)] [&>button:hover]:text-[var(--color-text)] [&>button]:transition-all [&>button]:duration-200"
          onInteractiveChange={(isInteractive) => console.log('[Controls] onInteractiveChange:', isInteractive)}
          onZoomIn={() => console.log('[Controls] onZoomIn clicked')}
          onZoomOut={() => console.log('[Controls] onZoomOut clicked')}
          onFitView={() => console.log('[Controls] onFitView clicked')}
        />
        <MiniMap
          className="!bg-[var(--glass-bg)] !backdrop-blur-md !border-[var(--glass-border)] !rounded-lg"
          viewportBorderRadius={8}
          maskStrokeWidth={2}
          pannable
          zoomable
        />
      </ReactFlow>
      {nodes.length === 0 && <EmptyCanvasState />}
    </div>
  )
}
