import { useEffect, useState } from 'react';
import { useExecutionStore } from '@/store/execution-store';
import { useWorkspaceStore } from '@/store/workspace-store';

export function useStreamOutput(nodeId: string) {
  const [output, setOutput] = useState('');
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path);

  useEffect(() => {
    if (!workspacePath) {
      setOutput('');
      return;
    }

    // Get initial output
    const initialOutput = useExecutionStore.getState().getStreamOutputForWorkspace(workspacePath, nodeId);
    setOutput(initialOutput);

    // Subscribe to store changes
    const unsubscribe = useExecutionStore.subscribe((state) => {
      const newOutput = state.getStreamOutputForWorkspace(workspacePath, nodeId);
      setOutput(newOutput);
    });

    return () => {
      unsubscribe();
    };
  }, [nodeId, workspacePath]);

  return output;
}