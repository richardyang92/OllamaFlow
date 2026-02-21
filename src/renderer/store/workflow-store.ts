import { create } from 'zustand'
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
    output: 'rgba(45, 212, 191, 0.6)', // teal
    image: 'rgba(255, 255, 255, 0.6)', // white
    readFile: 'rgba(251, 146, 60, 0.6)', // orange
    writeFile: 'rgba(251, 146, 60, 0.6)', // orange
    executeCommand: 'rgba(248, 113, 113, 0.6)', // red
    reactAgent: 'rgba(167, 139, 250, 0.6)', // purple - same as ollamaChat
  }
  return colorMap[nodeType] || 'rgba(255, 255, 255, 0.15)'
}

export function getEdgeHoverColorByNodeType(nodeType: NodeType): string {
  const colorMap: Record<NodeType, string> = {
    input: 'rgba(34, 211, 238, 0.9)', // cyan
    ollamaChat: 'rgba(167, 139, 250, 0.9)', // purple
    set: 'rgba(250, 204, 21, 0.9)', // yellow
    if: 'rgba(96, 165, 250, 0.9)', // blue
    loop: 'rgba(96, 165, 250, 0.9)', // blue
    output: 'rgba(45, 212, 191, 0.9)', // teal
    image: 'rgba(255, 255, 255, 0.9)', // white
    readFile: 'rgba(251, 146, 60, 0.9)', // orange
    writeFile: 'rgba(251, 146, 60, 0.9)', // orange
    executeCommand: 'rgba(248, 113, 113, 0.9)', // red
    reactAgent: 'rgba(167, 139, 250, 0.9)', // purple - same as ollamaChat
  }
  return colorMap[nodeType] || 'rgba(255, 255, 255, 0.4)'
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
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflow: null,
  isDirty: false,
  nodes: [],
  edges: [],
  selectedNodeId: null,

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
    })
  },

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  onNodesChange: (changes) => {
    const newNodes = applyNodeChanges(changes, get().nodes)
    set({ nodes: newNodes as Node<WorkflowNodeData>[], isDirty: true })
  },

  onEdgesChange: (changes) => {
    const newEdges = applyEdgeChanges(changes, get().edges)
    set({ edges: newEdges, isDirty: true })
  },

  onConnect: (connection: Connection) => {
    const sourceNode = get().nodes.find(n => n.id === connection.source)
    const nodeType = sourceNode?.data?.nodeType as NodeType | undefined
    const edgeColor = nodeType ? getEdgeColorByNodeType(nodeType) : 'rgba(255, 255, 255, 0.15)'
    const edgeHoverColor = nodeType ? getEdgeHoverColorByNodeType(nodeType) : 'rgba(255, 255, 255, 0.4)'

    const newEdge: Edge = {
      ...connection,
      id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    // Only update if the node still exists
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
}))
