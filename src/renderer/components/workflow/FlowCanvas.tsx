import { useCallback, useRef, DragEvent, useState, useEffect } from 'react'
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
import OutputNode from '@/components/nodes/OutputNode'
import ReadFileNode from '@/components/nodes/ReadFileNode'
import WriteFileNode from '@/components/nodes/WriteFileNode'
import ExecuteCommandNode from '@/components/nodes/ExecuteCommandNode'
import ImageNode from '@/components/nodes/ImageNode'
import ReactAgentNode from '@/components/nodes/ReactAgentNode'

import AnimatedEdge from '@/components/workflow/edges/AnimatedEdge'

function DebugClickDetector() {
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const isControls = target.closest('.react-flow__controls')
      const isControlsButton = target.closest('.react-flow__controls-button')
      console.log('[Debug] Click detected:', {
        target: target.tagName,
        className: target.className,
        isControls: !!isControls,
        isControlsButton: !!isControlsButton,
        clientX: e.clientX,
        clientY: e.clientY,
        composedPath: e.composedPath().slice(0, 5).map((el) => (el as HTMLElement).tagName)
      })
    }
    
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      const isControls = target.closest('.react-flow__controls')
      if (isControls) {
        console.log('[Debug] PointerDown on Controls:', {
          target: target.tagName,
          className: target.className,
          pointerType: e.pointerType,
          isPrimary: e.isPrimary,
          buttons: e.buttons
        })
      }
    }

    const checkControlsStyle = () => {
      const controls = document.querySelector('.react-flow__controls')
      if (controls) {
        const style = window.getComputedStyle(controls)
        console.log('[Debug] Controls computed style:', {
          pointerEvents: style.pointerEvents,
          webkitAppRegion: (style as any).webkitAppRegion || (style as any).getPropertyValue('-webkit-app-region'),
          zIndex: style.zIndex,
          position: style.position,
          display: style.display
        })
      } else {
        console.log('[Debug] Controls element not found')
      }
      
      const viewport = document.querySelector('.react-flow__viewport')
      if (viewport) {
        const style = window.getComputedStyle(viewport)
        console.log('[Debug] Viewport style:', {
          transform: style.transform,
          pointerEvents: style.pointerEvents
        })
      }
      
      const pane = document.querySelector('.react-flow__pane')
      if (pane) {
        const style = window.getComputedStyle(pane)
        console.log('[Debug] Pane style:', {
          pointerEvents: style.pointerEvents
        })
      }
    }

    window.addEventListener('click', handleGlobalClick, true)
    window.addEventListener('pointerdown', handlePointerDown, true)
    
    setTimeout(checkControlsStyle, 1000)
    
    return () => {
      window.removeEventListener('click', handleGlobalClick, true)
      window.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [])
  
  return null
}

function DebugZoomButtons() {
  useEffect(() => {
    const patchZoomButtons = () => {
      const zoomInBtn = document.querySelector('.react-flow__controls-zoomin')
      const zoomOutBtn = document.querySelector('.react-flow__controls-zoomout')
      const fitViewBtn = document.querySelector('.react-flow__controls-fitview')
      
      console.log('[Debug] Found buttons:', {
        zoomIn: !!zoomInBtn,
        zoomOut: !!zoomOutBtn,
        fitView: !!fitViewBtn
      })
      
      const handleZoomIn = () => {
        const rfInstance = (window as any).__REACT_FLOW_INSTANCE__
        console.log('[Debug] ZoomIn - ReactFlow instance:', !!rfInstance)
        if (rfInstance) {
          try {
            console.log('[Debug] Current zoom:', rfInstance.getZoom())
            console.log('[Debug] zoomIn method exists:', typeof rfInstance.zoomIn)
            const result = rfInstance.zoomIn({ duration: 300 })
            console.log('[Debug] zoomIn result:', result)
            setTimeout(() => console.log('[Debug] After zoomIn:', rfInstance.getZoom()), 350)
          } catch (e) {
            console.error('[Debug] zoomIn error:', e)
          }
        }
      }
      
      const handleZoomOut = () => {
        const rfInstance = (window as any).__REACT_FLOW_INSTANCE__
        console.log('[Debug] ZoomOut - ReactFlow instance:', !!rfInstance)
        if (rfInstance) {
          try {
            console.log('[Debug] Current zoom:', rfInstance.getZoom())
            console.log('[Debug] zoomOut method exists:', typeof rfInstance.zoomOut)
            const result = rfInstance.zoomOut({ duration: 300 })
            console.log('[Debug] zoomOut result:', result)
            setTimeout(() => console.log('[Debug] After zoomOut:', rfInstance.getZoom()), 350)
          } catch (e) {
            console.error('[Debug] zoomOut error:', e)
          }
        }
      }
      
      const handleFitView = () => {
        const rfInstance = (window as any).__REACT_FLOW_INSTANCE__
        console.log('[Debug] FitView - ReactFlow instance:', !!rfInstance)
        if (rfInstance) {
          try {
            const result = rfInstance.fitView({ duration: 300 })
            console.log('[Debug] fitView result:', result)
          } catch (e) {
            console.error('[Debug] fitView error:', e)
          }
        }
      }
      
      if (zoomInBtn) {
        zoomInBtn.addEventListener('click', handleZoomIn, true)
      }
      if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', handleZoomOut, true)
      }
      if (fitViewBtn) {
        fitViewBtn.addEventListener('click', handleFitView, true)
      }
      
      return () => {
        if (zoomInBtn) zoomInBtn.removeEventListener('click', handleZoomIn, true)
        if (zoomOutBtn) zoomOutBtn.removeEventListener('click', handleZoomOut, true)
        if (fitViewBtn) fitViewBtn.removeEventListener('click', handleFitView, true)
      }
    }
    
    setTimeout(patchZoomButtons, 1000)
  }, [])
  
  return null
}

const nodeTypes: Record<string, unknown> = {
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

const edgeTypes = {
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
    console.log('[Debug] ReactFlow onInit called, instance:', !!instance)
    ;(window as any).__REACT_FLOW_INSTANCE__ = instance
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

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    console.log('Edge clicked:', edge.id)
  }, [])

  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      if (params.edges.length > 0) {
        console.log('Edges selected:', params.edges.map(e => e.id))
      }
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
      <DebugClickDetector />
      <DebugZoomButtons />
      {nodes.length === 0 && <EmptyCanvasState />}
    </div>
  )
}
