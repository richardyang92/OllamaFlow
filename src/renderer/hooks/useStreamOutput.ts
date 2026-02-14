import { useEffect, useState } from 'react';
import { useExecutionStore } from '@/store/execution-store';

export function useStreamOutput(nodeId: string) {
  const [output, setOutput] = useState('');

  useEffect(() => {
    // Get initial output
    const initialOutput = useExecutionStore.getState().getStreamOutput(nodeId);
    setOutput(initialOutput);

    // Subscribe to store changes
    const unsubscribe = useExecutionStore.subscribe((state) => {
      const newOutput = state.getStreamOutput(nodeId);
      setOutput(newOutput);
    });

    return () => {
      unsubscribe();
    };
  }, [nodeId]);

  return output;
}