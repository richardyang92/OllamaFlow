import { useCallback, useRef, DragEvent, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
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
  SelectionMode,
  type ColorMode,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'
import { Target, ArrowDownToLine, Bot, GitBranch, ArrowUpFromLine, Blocks } from 'lucide-react'

import { useWorkflowStore } from '@/store/workflow-store'
import { WorkflowNodeData, WorkflowNode } from '@/types/node'
import { cn } from '@/lib/utils'

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
import PlanNode from '@/components/nodes/PlanNode'
import QueueNode from '@/components/nodes/QueueNode'
import SplitterNode from '@/components/nodes/SplitterNode'
import JoinNode from '@/components/nodes/JoinNode'
import HttpRequestNode from '@/components/nodes/HttpRequestNode'
import DelayNode from '@/components/nodes/DelayNode'
import JsonNode from '@/components/nodes/JsonNode'

import AnimatedEdge from '@/components/workflow/edges/AnimatedEdge'
import { MiniMap } from '@/components/workflow/MiniMap'
import PlanQuestionsManager from './PlanQuestionsManager'

const nodeTypes = {
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
  plan: PlanNode,
  queue: QueueNode,
  splitter: SplitterNode,
  join: JoinNode,
  httpRequest: HttpRequestNode,
  delay: DelayNode,
  json: JsonNode,
} as NodeTypes

const edgeTypes = {
  default: AnimatedEdge,
  animated: AnimatedEdge,
}

interface FlowCanvasProps {
  colorMode?: ColorMode
  onDragStart?: () => void
  onNodeClick?: () => void
  onPaneClick?: () => void
}

export interface FlowCanvasRef {
  fitView: () => void
}

function EmptyCanvasState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div className="relative max-w-md text-center p-8 rounded-2xl glass-panel overflow-hidden group">
        {/* Subtle top accent line */}
        <div className={cn(
          'absolute top-0 left-0 right-0 h-0.5',
          'bg-gradient-to-r from-transparent via-[var(--color-border-subtle)] to-transparent',
          'opacity-50 group-hover:opacity-100 transition-opacity duration-300'
        )} />

        {/* Subtle inner highlight on hover */}
        <div className={cn(
          'absolute inset-0 rounded-2xl pointer-events-none',
          'bg-gradient-to-br from-[var(--color-accent)]/3 via-transparent to-transparent',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
        )} />

        <div className="relative">
          {/* Icon with subtle background */}
          <div className={cn(
            'w-16 h-16 mx-auto mb-5 rounded-xl flex items-center justify-center',
            'bg-[var(--color-bg-input)]',
            'border border-[var(--color-border-subtle)]'
          )}>
            <Target className="w-8 h-8 text-[var(--color-text-muted)]" />
          </div>

          <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">开始构建工作流</h2>
          <div className="text-[var(--color-text-muted)] mb-6 space-y-1">
            <p>点击工具栏的<span className="text-[var(--color-text)] inline-flex items-center gap-1"><Blocks className="w-[16px] h-[16px] mx-[4px]" /></span>按钮打开节点面板</p>
            <p>拖拽节点到画布，连接它们创建自动化流程</p>
          </div>

          {/* Feature cards with enhanced styling */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className={cn(
              'p-3 rounded-xl transition-all duration-300',
              'bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)]',
              'group/card'
            )}>
              <div className={cn(
                'w-8 h-8 mb-2 rounded-lg flex items-center justify-center',
                'bg-[var(--color-accent)]/10'
              )}>
                <ArrowDownToLine className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <div className="text-sm font-semibold text-[var(--color-text)] mb-0.5">添加输入</div>
              <div className="text-xs text-[var(--color-text-muted)]">开始工作流的数据</div>
            </div>
            <div className={cn(
              'p-3 rounded-xl transition-all duration-300',
              'bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)]',
              'group/card'
            )}>
              <div className={cn(
                'w-8 h-8 mb-2 rounded-lg flex items-center justify-center',
                'bg-[var(--color-node-ai-bg)]'
              )}>
                <Bot className="w-4 h-4 text-[var(--color-node-ai)]" />
              </div>
              <div className="text-sm font-semibold text-[var(--color-text)] mb-0.5">AI 处理</div>
              <div className="text-xs text-[var(--color-text-muted)]">使用 Ollama 模型</div>
            </div>
            <div className={cn(
              'p-3 rounded-xl transition-all duration-300',
              'bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)]',
              'group/card'
            )}>
              <div className={cn(
                'w-8 h-8 mb-2 rounded-lg flex items-center justify-center',
                'bg-[var(--color-node-logic-bg)]'
              )}>
                <GitBranch className="w-4 h-4 text-[var(--color-node-logic)]" />
              </div>
              <div className="text-sm font-semibold text-[var(--color-text)] mb-0.5">条件逻辑</div>
              <div className="text-xs text-[var(--color-text-muted)]">分支和控制流</div>
            </div>
            <div className={cn(
              'p-3 rounded-xl transition-all duration-300',
              'bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)]',
              'group/card'
            )}>
              <div className={cn(
                'w-8 h-8 mb-2 rounded-lg flex items-center justify-center',
                'bg-[var(--color-node-output-bg)]'
              )}>
                <ArrowUpFromLine className="w-4 h-4 text-[var(--color-node-output)]" />
              </div>
              <div className="text-sm font-semibold text-[var(--color-text)] mb-0.5">输出结果</div>
              <div className="text-xs text-[var(--color-text-muted)]">显示或保存数据</div>
            </div>
          </div>

          {/* Steps guide */}
          <div className="mt-6 pt-6 border-t border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-center gap-3 text-xs text-[var(--color-text-muted)]">
              {[
                { num: '1', label: '打开面板' },
                { num: '2', label: '拖拽节点' },
                { num: '3', label: '连接端口' },
                { num: '4', label: '执行工作流' },
              ].map((step, i) => (
                <span key={step.num} className="flex items-center gap-1.5">
                  <span className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-medium',
                    'bg-[var(--color-bg-hover)]',
                    'text-[var(--color-text-muted)]'
                  )}>
                    {step.num}
                  </span>
                  {i < 3 && <span className="text-[var(--color-border)]">→</span>}
                  <span className="hidden sm:inline">{step.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const FlowCanvas = forwardRef<FlowCanvasRef, FlowCanvasProps>(function FlowCanvas(
  { colorMode = 'system', onDragStart, onNodeClick: onNodeClickProp, onPaneClick: onPaneClickProp },
  ref
) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<Node<WorkflowNodeData>, Edge> | null>(null)

  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectNode, copySelectedNodes, pasteNodes } =
    useWorkflowStore()

  const onInit = useCallback((instance: ReactFlowInstance<Node<WorkflowNodeData>, Edge>) => {
    setReactFlowInstance(instance)
  }, [])

  // Expose fitView method via ref
  useImperativeHandle(ref, () => ({
    fitView: () => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.2, duration: 200 })
      }
    }
  }), [reactFlowInstance])

  // Keyboard shortcuts for copy/paste
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd/Ctrl + C (copy)
      if ((event.metaKey || event.ctrlKey) && event.key === 'c') {
        const selectedNodes = nodes.filter(n => n.selected)
        if (selectedNodes.length > 0) {
          copySelectedNodes()
        }
      }
      // Check for Cmd/Ctrl + V (paste)
      if ((event.metaKey || event.ctrlKey) && event.key === 'v') {
        pasteNodes()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nodes, copySelectedNodes, pasteNodes])

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
          id: `${template.type}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
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
    onPaneClickProp?.()
  }, [selectNode, onPaneClickProp])

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
      className="w-full h-full overflow-hidden relative"
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
        selectionMode={SelectionMode.Partial}
        panOnDrag={true}
        selectionOnDrag={true}
        selectionKeyCode="Shift"
        panOnScroll={false}
        minZoom={0.5}
        maxZoom={2}
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
      <PlanQuestionsManager />
    </div>
  )
})

export default FlowCanvas
