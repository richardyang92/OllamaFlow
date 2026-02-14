import { WorkflowNode } from './node'
import { Edge } from '@xyflow/react'

export interface WorkflowMetadata {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  version: string
  tags?: string[]
}

export interface WorkflowViewport {
  x: number
  y: number
  zoom: number
}

export interface WorkflowSettings {
  timeout?: number
  retryCount?: number
  executionMode: 'sequential' | 'parallel'
}

export interface Workflow {
  metadata: WorkflowMetadata
  nodes: WorkflowNode[]
  edges: Edge[]
  viewport?: WorkflowViewport
  settings?: WorkflowSettings
}

export function createEmptyWorkflow(name: string): Workflow {
  return {
    metadata: {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    settings: {
      executionMode: 'sequential',
    },
  }
}
