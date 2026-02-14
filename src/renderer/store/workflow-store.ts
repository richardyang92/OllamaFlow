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
import type { WorkflowNodeData, WorkflowNode } from '@/types/node'
import type { Workflow } from '@/types/workflow'

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
    set({ nodes: newNodes, isDirty: true })
  },

  onEdgesChange: (changes) => {
    const newEdges = applyEdgeChanges(changes, get().edges)
    set({ edges: newEdges, isDirty: true })
  },

  onConnect: (connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `edge-${Date.now()}`,
      type: 'smoothstep',
      animated: true,
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
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ) as Node<WorkflowNodeData>[],
      isDirty: true,
    })
  },

  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
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
