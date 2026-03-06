import { create, useStore } from 'zustand'
import { temporal, type TemporalState } from 'zundo'
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
} from '@xyflow/react'
import type { WorkflowNodeData, WorkflowNode, NodeType } from '@/types/node'
import type { Workflow } from '@/types/workflow'

// Edge color mapping by node type
export function getEdgeColorByNodeType(nodeType: NodeType): string {
  const colorMap: Record<NodeType, string> = {
    input: 'rgba(34, 211, 238, 0.6)', // cyan
    ollamaChat: 'rgba(167, 139, 250, 0.6)', // purple
    set: 'rgba(250, 204, 21, 0.6)', // yellow
    if: 'rgba(96, 165, 250, 0.6)', // blue
    loop: 'rgba(96, 165, 250, 0.6)', // blue
    smartRouter: 'rgba(96, 165, 250, 0.6)', // blue
    output: 'rgba(45, 212, 191, 0.6)', // teal
    image: 'rgba(244, 114, 182, 0.6)', // pink
    readFile: 'rgba(251, 146, 60, 0.6)', // orange
    writeFile: 'rgba(251, 146, 60, 0.6)', // orange
    executeCommand: 'rgba(248, 113, 113, 0.6)', // red
    reactAgent: 'rgba(167, 139, 250, 0.6)', // purple - same as ollamaChat
    plan: 'rgba(167, 139, 250, 0.6)', // purple - same as reactAgent
    queue: 'rgba(52, 211, 153, 0.6)', // emerald
    splitter: 'rgba(251, 191, 36, 0.6)', // amber
    join: 'rgba(52, 211, 153, 0.6)', // emerald - same as queue
    httpRequest: 'rgba(99, 102, 241, 0.6)', // indigo
    delay: 'rgba(161, 161, 170, 0.6)', // zinc
    json: 'rgba(249, 115, 22, 0.6)', // orange
  }
  return colorMap[nodeType] || 'rgba(148, 163, 184, 0.5)' // slate
}

export function getEdgeHoverColorByNodeType(nodeType: NodeType): string {
  const colorMap: Record<NodeType, string> = {
    input: 'rgba(34, 211, 238, 0.9)', // cyan
    ollamaChat: 'rgba(167, 139, 250, 0.9)', // purple
    set: 'rgba(250, 204, 21, 0.9)', // yellow
    if: 'rgba(96, 165, 250, 0.9)', // blue
    loop: 'rgba(96, 165, 250, 0.9)', // blue
    smartRouter: 'rgba(96, 165, 250, 0.9)', // blue
    output: 'rgba(45, 212, 191, 0.9)', // teal
    image: 'rgba(244, 114, 182, 0.9)', // pink
    readFile: 'rgba(251, 146, 60, 0.9)', // orange
    writeFile: 'rgba(251, 146, 60, 0.9)', // orange
    executeCommand: 'rgba(248, 113, 113, 0.9)', // red
    reactAgent: 'rgba(167, 139, 250, 0.9)', // purple - same as ollamaChat
    plan: 'rgba(167, 139, 250, 0.9)', // purple - same as reactAgent
    queue: 'rgba(52, 211, 153, 0.9)', // emerald
    splitter: 'rgba(251, 191, 36, 0.9)', // amber
    join: 'rgba(52, 211, 153, 0.9)', // emerald - same as queue
    httpRequest: 'rgba(99, 102, 241, 0.9)', // indigo
    delay: 'rgba(161, 161, 170, 0.9)', // zinc
    json: 'rgba(249, 115, 22, 0.9)', // orange
  }
  return colorMap[nodeType] || 'rgba(148, 163, 184, 0.8)' // slate
}

interface WorkflowState {
  // Current workflow
  workflow: Workflow | null
  isDirty: boolean

  // React Flow state
  nodes: Node<WorkflowNodeData>[]
  edges: Edge[]

  // Selection
  selectedNodeId: string | null

  // Clipboard for copy/paste
  clipboard: Node<WorkflowNodeData>[]

  // Actions
  setWorkflow: (workflow: Workflow) => void
  clearWorkflow: () => void
  markDirty: () => void
  markClean: () => void

  // React Flow callbacks
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect

  // Node operations
  addNode: (node: WorkflowNode) => void
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void
  deleteNode: (nodeId: string) => void

  // Selection
  selectNode: (nodeId: string | null) => void
  getSelectedNode: () => WorkflowNode | null

  // Copy/Paste operations
  copySelectedNodes: () => void
  pasteNodes: () => void

  // Edge animation sync
  syncEdgeAnimation: (runningNodeIds: string[]) => void
}

export const useWorkflowStore = create<WorkflowState>()(
  temporal(
    (set, get) => ({
      workflow: null,
      isDirty: false,
      nodes: [],
      edges: [],
      selectedNodeId: null,
      clipboard: [],

      setWorkflow: (workflow) => {
        set({
          workflow,
          nodes: workflow.nodes as Node<WorkflowNodeData>[],
          edges: workflow.edges,
          isDirty: false,
        })
      },

      clearWorkflow: () => {
        set({
          workflow: null,
          nodes: [],
          edges: [],
          selectedNodeId: null,
          isDirty: false,
          clipboard: [],
        })
      },

      markDirty: () => set({ isDirty: true }),
      markClean: () => set({ isDirty: false }),

      onNodesChange: (changes) => {
        const newNodes = applyNodeChanges(changes, get().nodes)
        const hasSignificantChanges = changes.some((change) => {
          if (change.type === 'add' || change.type === 'remove') return true
          if (change.type === 'position' && change.dragging === false) return true
          return false
        })
        set({
          nodes: newNodes as Node<WorkflowNodeData>[],
          isDirty: hasSignificantChanges ? true : get().isDirty
        })
      },

      onEdgesChange: (changes) => {
        const newEdges = applyEdgeChanges(changes, get().edges)
        const hasSignificantChanges = changes.some((change) => {
          if (change.type === 'add' || change.type === 'remove') return true
          return false
        })
        set({ edges: newEdges, isDirty: hasSignificantChanges ? true : get().isDirty })
      },

      onConnect: (connection: Connection) => {
        const sourceNode = get().nodes.find(n => n.id === connection.source)
        const nodeType = sourceNode?.data?.nodeType as NodeType | undefined
        const edgeColor = nodeType ? getEdgeColorByNodeType(nodeType) : 'rgba(255, 255, 255, 0.15)'
        const edgeHoverColor = nodeType ? getEdgeHoverColorByNodeType(nodeType) : 'rgba(255, 255, 255, 0.4)'

        const newEdge: Edge = {
          ...connection,
          id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          type: 'default',
          animated: false,
          selectable: true,
          deletable: true,
          style: {
            stroke: edgeColor,
            strokeWidth: 2,
          },
          data: {
            hoverColor: edgeHoverColor,
            baseColor: edgeColor,
          },
        }
        set({
          edges: addEdge(newEdge, get().edges),
          isDirty: true,
        })
      },

      addNode: (node) => {
        set({
          nodes: [...get().nodes, node as Node<WorkflowNodeData>],
          isDirty: true,
        })
      },

      updateNodeData: (nodeId, data) => {
        const currentState = get();
        const nodeExists = currentState.nodes.some(node => node.id === nodeId);

        if (nodeExists) {
          set({
            nodes: currentState.nodes.map((node) =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, ...data } }
                : node
            ) as Node<WorkflowNodeData>[],
            isDirty: true,
          });
        }
      },

      deleteNode: (nodeId) => {
        const currentState = get();
        set({
          nodes: currentState.nodes.filter((node) => node.id !== nodeId),
          edges: currentState.edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          ),
          selectedNodeId: currentState.selectedNodeId === nodeId ? null : currentState.selectedNodeId,
          isDirty: true,
        })
      },

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      getSelectedNode: () => {
        const { nodes, selectedNodeId } = get()
        if (!selectedNodeId) return null
        return nodes.find((n) => n.id === selectedNodeId) as WorkflowNode | null
      },

      copySelectedNodes: () => {
        const selectedNodes = get().nodes.filter(n => n.selected)
        set({ clipboard: JSON.parse(JSON.stringify(selectedNodes)) })
      },

      pasteNodes: () => {
        const { clipboard, nodes } = get()
        if (clipboard.length === 0) return

        const offset = { x: 50, y: 50 }
        const newNodes = clipboard.map(node => ({
          ...node,
          id: `${node.type}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
          selected: true
        }))

        const deselectedNodes = nodes.map(n => ({ ...n, selected: false }))
        set({
          nodes: [...deselectedNodes, ...newNodes] as Node<WorkflowNodeData>[],
          isDirty: true
        })
      },

      syncEdgeAnimation: (runningNodeIds: string[]) => {
        const { edges, workflow } = get()
        if (!workflow || edges.length === 0) return

        const runningNodeIdsSet = new Set(runningNodeIds)
        const updatedEdges = edges.map((edge) => {
          const shouldBeAnimated = runningNodeIdsSet.has(edge.target)
          if (edge.animated !== shouldBeAnimated) {
            return { ...edge, animated: shouldBeAnimated }
          }
          return edge
        })

        const hasChanges = updatedEdges.some((e, i) => e.animated !== edges[i].animated)
        if (hasChanges) {
          set({
            edges: updatedEdges,
            workflow: { ...workflow, edges: updatedEdges }
          })
        }
      },
    }),
    {
      limit: 50,
    }
  )
)

// Export temporal store hook for undo/redo
export const useTemporalStore = <T,>(selector: (state: TemporalState<WorkflowState>) => T): T => {
  return useStore(useWorkflowStore.temporal, selector)
}
