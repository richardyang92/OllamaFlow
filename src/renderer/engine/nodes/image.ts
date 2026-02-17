import type { Node } from '@xyflow/react'
import type { WorkflowNodeData, ImageNodeData } from '@/types/node'
import type { NodeExecutor, ExecutionContext } from '../executor'
import { useWorkflowStore } from '@/store/workflow-store'
import { useWorkspaceStore } from '@/store/workspace-store'

export function createImageExecutor(): NodeExecutor {
  return {
    async execute(
      node: Node<WorkflowNodeData>,
      input: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<unknown> {
      const data = node.data as ImageNodeData
      let imageUrl = input.data as string
      
      if (imageUrl) {
        // Handle local paths - keep as relative path for better handling in UI
        const workspaceStore = useWorkspaceStore.getState()
        const currentWorkspace = workspaceStore.currentWorkspace
        
        // Update node data to display image URL in the UI
        const workflowStore = useWorkflowStore.getState()
        workflowStore.updateNodeData(node.id, { imageUrl })

        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'info',
          message: `显示图片: ${imageUrl}`,
          data: imageUrl,
        })

        return {
          data: imageUrl,
        }
      } else {
        context.onLog?.({
          nodeId: node.id,
          nodeName: data.label,
          level: 'warn',
          message: '未提供图片URL',
        })

        return {
          data: null,
        }
      }
    },
  }
}