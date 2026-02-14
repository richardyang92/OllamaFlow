import { useWorkflowStore } from '@/store/workflow-store';
import type { WorkflowNodeData } from '@/types/node';

export function safeUpdateNodeData(nodeId: string, data: Partial<WorkflowNodeData>) {
  // Check if node still exists before updating
  const currentWorkflowStore = useWorkflowStore.getState();
  const workflowNodes = currentWorkflowStore.nodes;
  if (workflowNodes.some(n => n.id === nodeId)) {
    currentWorkflowStore.updateNodeData(nodeId, data);
  }
}